// External modules
import * as fs            from 'fs';
import * as os            from 'os';
import * as path          from 'path';
import { v4 as uuidv4 }   from 'uuid';
import * as vscode        from 'vscode';

// Constants
import { MODEL_SELECTOR } from '../consts/model.const';
import { project }        from '../consts/project.const';

// Types
import { CustomCmd }      from '../types/cmd.type';

export class CmdHelper
{
  public static genericCmdId : string = 'ai.styleInEditor';

  public static async runGenericCommand(editor : vscode.TextEditor) : Promise<void>
  {
    // NOTE Get Preferences > Settings > customCommands
    const extConfig = vscode.workspace.getConfiguration('style-copilot');
    const commands : CustomCmd[] = extConfig.ai.customCommands;

    // NOTE Commands not found
    if (!commands || commands.length === 0)
    {
      vscode.window.showInformationMessage('No custom commands defined.');
      return;
    }

    // NOTE Ask user to pick a command
    const picked = await vscode.window.showQuickPick(commands.map(c => c.id), {
      placeHolder : 'Select a custom command'
    });
    const cmd = commands.find(c => c.id === picked);

    // NOTE Command not found
    if (!cmd)
    {
      vscode.window.showInformationMessage('No custom command found.');
      return;
    }

    const text = editor.document.getText();
    let chatResponse : vscode.LanguageModelChatResponse | undefined;
    try
    {
      const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
      if (!model)
      {
        console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
        return;
      }

      // NOTE Insert the custom prompt and the user file into the model
      const messages = [
        vscode.LanguageModelChatMessage.User(cmd.prompt),
        vscode.LanguageModelChatMessage.User(text)
      ];
      chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
    }
    catch (err)
    {
      if (err instanceof vscode.LanguageModelError)
        console.log(err.message, err.code, err.cause);
      else
        throw err;
      return;
    }

    try
    {
      // NOTE Show loading in the status bar
      vscode.window.withProgress({
        location : vscode.ProgressLocation.Window,
        title    : `StyleCopilot [${cmd.id}]`
      }, async () =>
      {
        // NOTE Build response
        const fragments : string[] = [];
        for await (const fragment of chatResponse.text)
          fragments.push(fragment);
        const result = fragments.join('');

        // NOTE Show diff and ask user
        CmdHelper.showDiffAndAskUser(cmd, editor.document, result);
      });
    }
    catch (err)
    {
      // NOTE Async response stream may fail, e.g network interruption or server side error
      await editor.edit(edit =>
      {
        const lastLine = editor.document.lineAt(editor.document.lineCount - 1);
        const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
        edit.insert(position, (<Error>err).message);
      });
    }
  }

  private static async showDiffAndAskUser(cmd : CustomCmd, originalDoc : vscode.TextDocument, newContent : string) : Promise<void>
  {
    // NOTE Create a temporary file with the result
    const uniqueId     = uuidv4();
    const commandName  = `[${cmd.id}] ${uniqueId}`;
    const originalExt  = path.extname(originalDoc.fileName);
    const tempFileName = `${project.fileName}-temp-${uniqueId}.${originalExt}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempFilePath, newContent, 'utf8');

    // NOTE Open a diff editor to compare the original content with the result
    const tempUri     = vscode.Uri.file(tempFilePath);
    const originalUri = originalDoc.uri;
    const diffTitle   = `${project.name}: ${commandName}`;
    await vscode.commands.executeCommand('vscode.diff', originalUri, tempUri, diffTitle);

    // NOTE Ask the user if they want to accept the changes
    const userDecision = await vscode.window.showInformationMessage(
      `Accept changes? ${commandName}`, '✅ Yes', '❌ No'
    );

    if (userDecision === '✅ Yes')
      await CmdHelper.applyChanges(originalDoc, newContent);

    // NOTE Close the diff editor
    await CmdHelper.closeDiffEditor(tempUri);
  }

  private static async applyChanges(doc : vscode.TextDocument, newContent : string) : Promise<void>
  {
    try
    {
      // NOTE Apply the changes to the document
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(doc.lineCount, doc.lineAt(doc.lineCount - 1).text.length)
      );
      edit.replace(doc.uri, fullRange, newContent);

      // NOTE Apply the edit
      const success = await vscode.workspace.applyEdit(edit);
      if (success)
        vscode.window.showInformationMessage('✅ Changes applied successfully.');
      else
        vscode.window.showErrorMessage('🔙 Changes discarded.');

      // NOTE Save the document
      await doc.save();
    }
    catch (error)
    {
      console.error('CmdHelper : applyChanges -> error', error);
      vscode.window.showErrorMessage('Failed to apply changes.');
    }
  }

  private static async closeDiffEditor(tempUri : vscode.Uri) : Promise<void>
  {
    let found = false;
    for (const editor of vscode.window.visibleTextEditors)
    {
      if (editor.document.uri.toString() === tempUri.toString())
      {
        found = true;
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        break;
      }
    }
    if (!found)
      console.log('Diff editor not found.');
  }
}