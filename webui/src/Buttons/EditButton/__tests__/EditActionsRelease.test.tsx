import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionSetsModel } from '@companion-app/shared/Model/ActionModel.js'
import type { IControlActionStepsAndSetsService } from '~/Services/Controls/ControlActionStepsAndSetsService.js'
import { EditActionsRelease } from '../EditActionsRelease.js'

const rename = vi.hoisted(() => vi.fn())
const setRunWhileHeld = vi.hoisted(() => vi.fn())

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		controls: {
			actionSets: {
				rename: { mutationOptions: () => ({ mutation: 'rename' }) },
				setRunWhileHeld: { mutationOptions: () => ({ mutation: 'setRunWhileHeld' }) },
			},
		},
	},
	useMutationExt: (options: { mutation: string }) => ({
		mutateAsync: options.mutation === 'rename' ? rename : setRunWhileHeld,
	}),
}))

vi.mock('~/Controls/EntitiesEditor.js', () => ({
	ControlEntitiesEditor: ({ heading, headingActions }: { heading: string; headingActions?: React.ReactNode }) => (
		<section aria-label={heading}>
			<h2>{heading}</h2>
			{headingActions}
		</section>
	),
}))

const actionSets: ActionSetsModel = {
	down: [],
	up: [],
	rotate_left: undefined,
	rotate_right: undefined,
	1000: [],
	2000: [],
}

beforeEach(() => {
	rename.mockReset()
	setRunWhileHeld.mockReset()
	setRunWhileHeld.mockResolvedValue(true)
})

describe('EditActionsRelease', () => {
	it('does not apply metadata to an existing group when rename is refused', async () => {
		rename.mockResolvedValue(false)
		const setHapticFeedback = vi.fn()
		const service = { setHapticFeedback } as unknown as IControlActionStepsAndSetsService
		const user = userEvent.setup()

		render(
			<EditActionsRelease
				controlId="control0"
				location={{ pageNumber: 1, row: 0, column: 0 }}
				action_sets={actionSets}
				stepOptions={{ runWhileHeld: [] }}
				stepId="0"
				service={service}
				removeSet={vi.fn()}
				localVariablesStore={{} as never}
			/>
		)

		const group = screen.getByRole('region', { name: 'Release after 1000ms actions' })
		await user.click(within(group).getByTitle('Configure'))

		const dialog = screen.getByRole('dialog')
		const duration = within(dialog).getByLabelText('Press duration')
		await user.clear(duration)
		await user.type(duration, '2000')
		await user.click(within(dialog).getByRole('checkbox', { name: 'Haptic feedback' }))

		await act(async () => {
			await user.click(within(dialog).getByRole('button', { name: 'Save' }))
		})

		expect(rename).toHaveBeenCalledWith({ controlId: 'control0', stepId: '0', oldSetId: 1000, newSetId: 2000 })
		expect(setRunWhileHeld).not.toHaveBeenCalled()
		expect(setHapticFeedback).not.toHaveBeenCalled()
	})

	it('relies on a successful rename to preserve unchanged group preferences', async () => {
		rename.mockResolvedValue(true)
		const setHapticFeedback = vi.fn()
		const service = { setHapticFeedback } as unknown as IControlActionStepsAndSetsService
		const user = userEvent.setup()

		render(
			<EditActionsRelease
				controlId="control0"
				location={{ pageNumber: 1, row: 0, column: 0 }}
				action_sets={actionSets}
				stepOptions={{ runWhileHeld: [], hapticDisabledSets: [1000] }}
				stepId="0"
				service={service}
				removeSet={vi.fn()}
				localVariablesStore={{} as never}
			/>
		)

		const group = screen.getByRole('region', { name: 'Release after 1000ms actions' })
		await user.click(within(group).getByTitle('Configure'))

		const dialog = screen.getByRole('dialog')
		const duration = within(dialog).getByLabelText('Press duration')
		await user.clear(duration)
		await user.type(duration, '1500')

		await act(async () => {
			await user.click(within(dialog).getByRole('button', { name: 'Save' }))
		})

		expect(rename).toHaveBeenCalledWith({ controlId: 'control0', stepId: '0', oldSetId: 1000, newSetId: 1500 })
		expect(setRunWhileHeld).not.toHaveBeenCalled()
		expect(setHapticFeedback).not.toHaveBeenCalled()
	})

	it('updates haptic feedback when the duration is unchanged', async () => {
		const setHapticFeedback = vi.fn()
		const service = { setHapticFeedback } as unknown as IControlActionStepsAndSetsService
		const user = userEvent.setup()

		render(
			<EditActionsRelease
				controlId="control0"
				location={{ pageNumber: 1, row: 0, column: 0 }}
				action_sets={actionSets}
				stepOptions={{ runWhileHeld: [] }}
				stepId="0"
				service={service}
				removeSet={vi.fn()}
				localVariablesStore={{} as never}
			/>
		)

		const group = screen.getByRole('region', { name: 'Release after 1000ms actions' })
		await user.click(within(group).getByTitle('Configure'))

		const dialog = screen.getByRole('dialog')
		await user.click(within(dialog).getByRole('checkbox', { name: 'Haptic feedback' }))
		await act(async () => {
			await user.click(within(dialog).getByRole('button', { name: 'Save' }))
		})

		expect(rename).not.toHaveBeenCalled()
		expect(setRunWhileHeld).not.toHaveBeenCalled()
		expect(setHapticFeedback).toHaveBeenCalledTimes(1)
		expect(setHapticFeedback).toHaveBeenCalledWith('0', 1000, false)
	})

	it('updates haptic feedback on the renamed group after a successful rename', async () => {
		rename.mockResolvedValue(true)
		const setHapticFeedback = vi.fn()
		const service = { setHapticFeedback } as unknown as IControlActionStepsAndSetsService
		const user = userEvent.setup()

		render(
			<EditActionsRelease
				controlId="control0"
				location={{ pageNumber: 1, row: 0, column: 0 }}
				action_sets={actionSets}
				stepOptions={{ runWhileHeld: [] }}
				stepId="0"
				service={service}
				removeSet={vi.fn()}
				localVariablesStore={{} as never}
			/>
		)

		const group = screen.getByRole('region', { name: 'Release after 1000ms actions' })
		await user.click(within(group).getByTitle('Configure'))

		const dialog = screen.getByRole('dialog')
		const duration = within(dialog).getByLabelText('Press duration')
		await user.clear(duration)
		await user.type(duration, '1500')
		await user.click(within(dialog).getByRole('switch', { name: 'Execute while held' }))
		await user.click(within(dialog).getByRole('checkbox', { name: 'Haptic feedback' }))
		await act(async () => {
			await user.click(within(dialog).getByRole('button', { name: 'Save' }))
		})

		expect(rename).toHaveBeenCalledWith({ controlId: 'control0', stepId: '0', oldSetId: 1000, newSetId: 1500 })
		expect(setRunWhileHeld).toHaveBeenCalledTimes(1)
		expect(setRunWhileHeld).toHaveBeenCalledWith({
			controlId: 'control0',
			stepId: '0',
			setId: 1500,
			runWhileHeld: true,
		})
		expect(setHapticFeedback).toHaveBeenCalledTimes(1)
		expect(setHapticFeedback).toHaveBeenCalledWith('0', 1500, false)
	})
})
