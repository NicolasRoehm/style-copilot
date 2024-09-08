// External modules
import * as vscode        from 'vscode';

// Constants
import { MODEL_SELECTOR } from '../consts/model.const';

// Types
import { CustomAction }   from '../types/cmd.type';

export class ActionHelper
{
  public static async runAction(act : CustomAction, req : vscode.ChatRequest, stream : vscode.ChatResponseStream, token : vscode.CancellationToken) : Promise<void>
  {
    stream.progress(act.loadingLabel || 'Loading...');

    try
    {
      const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
      if (!model)
      {
        console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
        return;
      }

      const prompt   = act.prompt.replace(`/${act.id} `, '');
      const messages = [ vscode.LanguageModelChatMessage.User(prompt) ];
      
      // NOTE Add active tab content
      const text = vscode.window.activeTextEditor?.document.getText() || '';
      if (text)
        messages.push(vscode.LanguageModelChatMessage.User(text));

      // NOTE Get the references
      for (const ref of req.references)
      {
        const uri = ref.value as vscode.Uri;
        const doc = await vscode.workspace.openTextDocument(uri);
        const refText = doc.getText();
        messages.push(vscode.LanguageModelChatMessage.User(refText));
      }

      const chatResponse = await model.sendRequest(messages, {}, token);
      for await (const fragment of chatResponse.text)
        stream.markdown(fragment);
    }
    catch (err)
    {
      console.error('ActionHelper : runAction -> error', err);
    }
  }
}