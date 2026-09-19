import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'

interface ActionSetHapticFeedbackCheckboxProps {
	enabled: boolean
	setEnabled: (enabled: boolean) => void
}

export function ActionSetHapticFeedbackCheckbox({
	enabled,
	setEnabled,
}: ActionSetHapticFeedbackCheckboxProps): React.JSX.Element {
	return (
		<CheckboxInputFieldWithLabel
			className="me-2 flex items-center"
			label="Haptic feedback"
			value={enabled}
			setValue={(value) => setEnabled(value)}
		/>
	)
}
