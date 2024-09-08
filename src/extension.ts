// External modules
import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode      from 'vscode';
import { workspace }    from 'vscode';
import * as fs from 'fs';


import { PlayPrompt }   from './play';
import { CmdHelper } from './helpers/cmd.helper';
import { MODEL_SELECTOR } from './consts/model.const';

const CAT_NAMES_COMMAND_ID = 'ai.styleInEditor';
const CAT_PARTICIPANT_ID = 'style-copilot.ai';

interface ICatChatResult extends vscode.ChatResult {
  metadata: {
    command: string;
  }
}

export function activate(context: vscode.ExtensionContext) {

  // Define a Cat chat handler. 
  const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken): Promise<ICatChatResult> => {
    // To talk to an LLM in your subcommand handler implementation, your
    // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
    // The GitHub Copilot Chat extension implements this provider.
    if (request.command === 'randomTeach') {
      stream.progress('Picking the right topic to teach...');
      const topic = getTopic(context.history);
      try {
        // To get a list of all available models, do not pass any selector to the selectChatModels.
        const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
        if (model) {
          const messages = [
            vscode.LanguageModelChatMessage.User('You are a cat! Your job is to explain computer science concepts in the funny manner of a cat. Always start your response by stating what concept you are explaining. Always include code samples.'),
            vscode.LanguageModelChatMessage.User(topic)
          ];

          const chatResponse = await model.sendRequest(messages, {}, token);
          for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
          }
        }
      } catch (err) {
        handleError(logger, err, stream);
      }

      stream.button({
        command: CAT_NAMES_COMMAND_ID,
        title: vscode.l10n.t('Use Cat Names in Editor')
      });

      logger.logUsage('request', { kind: 'randomTeach' });
      return { metadata: { command: 'randomTeach' } };
    } else if (request.command === 'play') {
      stream.progress('Throwing away the computer science books and preparing to play with some Python code...');
      try {
        const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
        if (model) {
          // Here's an example of how to use the prompt-tsx library to build a prompt
          const { messages } = await renderPrompt(
            PlayPrompt,
            { userQuery: request.prompt },
            { modelMaxPromptTokens: model.maxInputTokens },
            model);

          const chatResponse = await model.sendRequest(messages, {}, token);
          for await (const fragment of chatResponse.text) {
            stream.markdown(fragment);
          }
        }
      } catch (err) {
        handleError(logger, err, stream);
      }

      logger.logUsage('request', { kind: 'play' });
      return { metadata: { command: 'play' } };
    } else {
      try {
        const [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
        if (model) {
          const messages = [
            vscode.LanguageModelChatMessage.User(`You are a cat! Think carefully and step by step like a cat would.
                            Your job is to explain computer science concepts in the funny manner of a cat, using cat metaphors. Always start your response by stating what concept you are explaining. Always include code samples.`),
            vscode.LanguageModelChatMessage.User(request.prompt)
          ];

          const chatResponse = await model.sendRequest(messages, {}, token);
          for await (const fragment of chatResponse.text) {
            // Process the output from the language model
            // Replace all python function definitions with cat sounds to make the user stop looking at the code and start playing with the cat
            const catFragment = fragment.replaceAll('def', 'meow');
            stream.markdown(catFragment);
          }
        }
      } catch (err) {
        handleError(logger, err, stream);
      }

      logger.logUsage('request', { kind: '' });
      return { metadata: { command: '' } };
    }
  };

  // Chat participants appear as top-level options in the chat input
  // when you type `@`, and can contribute sub-commands in the chat input
  // that appear when you type `/`.
  const cat = vscode.chat.createChatParticipant(CAT_PARTICIPANT_ID, handler);
  cat.iconPath = vscode.Uri.joinPath(context.extensionUri, 'cat.jpeg');
  cat.followupProvider = {
    provideFollowups(result: ICatChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
      return [{
        prompt: 'let us play',
        label: vscode.l10n.t('Play with the cat'),
        command: 'play'
      } satisfies vscode.ChatFollowup];
    }
  };

  const logger = vscode.env.createTelemetryLogger({
    sendEventData(eventName, data) {
      // Capture event telemetry
      console.log(`Event: ${eventName}`);
      console.log(`Data: ${JSON.stringify(data)}`);
    },
    sendErrorData(error, data) {
      // Capture error telemetry
      console.error(`Error: ${error}`);
      console.error(`Data: ${JSON.stringify(data)}`);
    }
  });

  context.subscriptions.push(cat.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
    // Log chat result feedback to be able to compute the success matric of the participant
    // unhelpful / totalRequests is a good success metric
    logger.logUsage('chatResultFeedback', {
      kind: feedback.kind
    });
  }));

  // NOTE Register a generic command
  context.subscriptions.push(cat,
    vscode.commands.registerTextEditorCommand(CmdHelper.genericCmdId, async (editor) =>
    {
      CmdHelper.runGenericCommand(editor);
    })
  );

}

function handleError(logger: vscode.TelemetryLogger, err: any, stream: vscode.ChatResponseStream): void {
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

// Get a random topic that the cat has not taught in the chat history yet
function getTopic(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): string {
  const topics = ['linked list', 'recursion', 'stack', 'queue', 'pointers'];
  // Filter the chat history to get only the responses from the cat
  const previousCatResponses = history.filter(h => {
    return h instanceof vscode.ChatResponseTurn && h.participant === CAT_PARTICIPANT_ID;
  }) as vscode.ChatResponseTurn[];
  // Filter the topics to get only the topics that have not been taught by the cat yet
  const topicsNoRepetition = topics.filter(topic => {
    return !previousCatResponses.some(catResponse => {
      return catResponse.response.some(r => {
        return r instanceof vscode.ChatResponseMarkdownPart && r.value.value.includes(topic);
      });
    });
  });

  return topicsNoRepetition[Math.floor(Math.random() * topicsNoRepetition.length)] || 'I have taught you everything I know. Meow!';
}

export function deactivate() { }
