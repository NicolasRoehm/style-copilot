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

    await ActionHelper.runAction(action, request, stream, token);
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

  // NOTE Register a generic command
  context.subscriptions.push(at,
    vscode.commands.registerTextEditorCommand(CmdHelper.genericCmdId, async (editor) =>
    {
      CmdHelper.runGenericCommand(editor);
    })
  );
}

export function deactivate() { }
