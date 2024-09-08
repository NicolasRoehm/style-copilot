import * as vscode from 'vscode';

// NOTE Use gpt-4o since it is fast and high quality. gpt-3.5-turbo and gpt-4 are also available.
export const MODEL_SELECTOR : vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'gpt-4o' };
