// External modules
import * as vscode        from 'vscode';

// Constants
import { MODEL_SELECTOR } from '../consts/model.const';

export class ActionHelper
{
  public static async runAnalyzeAction(req : vscode.ChatRequest, stream : vscode.ChatResponseStream, token : vscode.CancellationToken, logger : vscode.TelemetryLogger) : Promise<void>
  {
    stream.progress('Analyzing the file...');

    try
    {
      const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
      if (!model)
      {
        console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
        return;
      }

      const analyzePrompt = `
      `;
      // const analyzePrompt = `
      //   Analyze the following code and respond with a table containing the following information:
      //   - Unused variables (count)
      //   - Unused functions (count)
      //   - Count of variables that should be const instead of let
      //   - Count of functions that should be private instead of public`;
      
      const messages = [ vscode.LanguageModelChatMessage.User(analyzePrompt) ];
      
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
      ActionHelper.handleError(logger, err, stream);
    }
  }

  public static handleError(logger : vscode.TelemetryLogger, err : any, stream : vscode.ChatResponseStream) : void
  {
    // making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    logger.logError(err);
  
    if (err instanceof vscode.LanguageModelError) {
      console.log(err.message, err.code, err.cause);
      if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
        stream.markdown(vscode.l10n.t('I\'m sorry, I can only explain computer science concepts.'));
      }
    } else {
      // re-throw other errors so they show up in the UI
      throw err;
    }
  }
}