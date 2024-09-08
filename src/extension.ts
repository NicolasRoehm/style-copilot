// External modules
import * as vscode      from 'vscode';

// Helpers
import { CmdHelper }    from './helpers/cmd.helper';
import { ActionHelper } from './helpers/action.helper';

// Types
import { CustomAction } from './types/cmd.type';

export function activate(context : vscode.ExtensionContext)
{
  // NOTE Get Preferences > Settings > customActions
  const extConfig = vscode.workspace.getConfiguration('style-copilot');
  var actions : CustomAction[] = extConfig.ai.customActions;

  // NOTE Define the chat handler
  const handler : vscode.ChatRequestHandler = async (request, context, stream, token) : Promise<vscode.ChatResult> =>
  {
    // NOTE Extract action.id from prompt
    const actionId = request.prompt.split(' ')[0].replace('/', '');
    const action   = actions.find(a => a.id === actionId);

    if (!action)
      return {};

    await ActionHelper.runAnalyzeAction(action, request, stream, token, logger);
    logger.logUsage('request', { kind : '' });
    return {};
  };

  // NOTE Create the custom @StyleCopilot AI chat participant
  const at    = vscode.chat.createChatParticipant('style-copilot.ai', handler);
  at.iconPath = vscode.Uri.joinPath(context.extensionUri, 'style.png');
  at.followupProvider = {
    provideFollowups(result, context, token)
    {
      // NOTE Attatch custom actions
      const ups : vscode.ChatFollowup[] = [];
      for (const action of actions)
        ups.push({
          prompt  : action.prompt || '',
          label   : vscode.l10n.t(action.label),
          command : action.id
        });
      return ups;
    }
  };

  const logger = vscode.env.createTelemetryLogger({
    sendEventData(eventName, data) {
      // NOTE Capture event telemetry
      console.log(`Event: ${eventName}`);
      console.log(`Data: ${JSON.stringify(data)}`);
    },
    sendErrorData(error, data) {
      // NOTE Capture error telemetry
      console.error(`Error: ${error}`);
      console.error(`Data: ${JSON.stringify(data)}`);
    }
  });

  context.subscriptions.push(at.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) =>
  {
    // Log chat result feedback to be able to compute the success matric of the participant
    // unhelpful / totalRequests is a good success metric
    logger.logUsage('chatResultFeedback', {
      kind: feedback.kind
    });
  }));

  // NOTE Register a generic command
  context.subscriptions.push(at,
    vscode.commands.registerTextEditorCommand(CmdHelper.genericCmdId, async (editor) =>
    {
      CmdHelper.runGenericCommand(editor);
    })
  );
}

export function deactivate() { }
