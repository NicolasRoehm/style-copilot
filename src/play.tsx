import {
	BasePromptElementProps,
	PromptElement,
	PromptSizing,
	UserMessage
} from '@vscode/prompt-tsx';

export interface PromptProps extends BasePromptElementProps {
	userQuery: string;
}

export class PlayPrompt extends PromptElement<PromptProps, void> {
	render(state: void, sizing: PromptSizing) {
		return (
			<>
				<UserMessage>
					Analyze the file and create a well formatted response with the following information:
					- How many unused imports are in the file?
					- How many unused variables are in the file?
					- How many unused functions are in the file?
					- Do some of the functions must be private instead of public?
					- How many variables should be const instead of let?
				</UserMessage>
				<UserMessage>{this.props.userQuery}</UserMessage>
			</>
		);
	}
}
