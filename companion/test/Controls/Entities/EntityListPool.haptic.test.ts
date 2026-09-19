import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { ButtonModelBase } from '@companion-app/shared/Model/ButtonModel.js'
import { ControlEntityListPoolButton } from '../../../lib/Controls/Entities/EntityListPoolButton.js'
import { actionModel, createPool, createPoolDeps, downSet } from './EntityListPoolTestHelpers.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

function buttonStorage(options: ActionStepOptions, includeDuration = true): ButtonModelBase {
	return {
		feedbacks: [],
		localVariables: [],
		steps: {
			'0': {
				action_sets: {
					down: [],
					up: [],
					rotate_left: undefined,
					rotate_right: undefined,
					...(includeDuration ? { 1000: [] } : {}),
				},
				options,
			},
		},
	}
}

describe('button action-set haptic preferences', () => {
	test('defaults existing press groups to enabled and rejects unsupported groups', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		expect(pool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'up')).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 1000)).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'rotate_left')).toBe(false)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 2000)).toBe(false)
		expect(pool.isActionSetHapticFeedbackEnabled('missing', 'down')).toBe(false)
	})

	test('normalizes malformed stored preferences against the groups that exist', () => {
		const { pool } = createPool()
		const malformedOptions = {
			runWhileHeld: [],
			hapticDisabledSets: ['down', 'up', 1000, 1000, 'rotate_left', 9999, Infinity, '1000', null],
		} as unknown as ActionStepOptions

		pool.loadStorage(buttonStorage(malformedOptions), true, false)

		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toEqual(['down', 'up', 1000])
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(false)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'up')).toBe(false)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 1000)).toBe(false)
	})

	test('treats a non-array stored preference as the default enabled state', () => {
		const { pool } = createPool()
		const malformedOptions = {
			runWhileHeld: [],
			hapticDisabledSets: 'down',
		} as unknown as ActionStepOptions

		pool.loadStorage(buttonStorage(malformedOptions, false), true, false)

		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toBeUndefined()
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(true)
	})

	test('persists toggles through a storage round-trip', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')

		expect(pool.actionSetHapticFeedback('0', 'down', false)).toBe(true)
		expect(pool.actionSetHapticFeedback('0', 1000, false)).toBe(true)

		const { pool: reloadedPool } = createPool()
		reloadedPool.loadStorage(
			{
				feedbacks: [],
				localVariables: [],
				steps: structuredClone(pool.asNormalButtonSteps()),
			},
			true,
			false
		)

		expect(reloadedPool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(false)
		expect(reloadedPool.isActionSetHapticFeedbackEnabled('0', 'up')).toBe(true)
		expect(reloadedPool.isActionSetHapticFeedbackEnabled('0', 1000)).toBe(false)
	})

	test('validates mutations and removes the optional field after the last group is re-enabled', () => {
		const { pool } = createPool()

		expect(pool.actionSetHapticFeedback('0', 'rotate_right', false)).toBe(false)
		expect(pool.actionSetHapticFeedback('0', Infinity, false)).toBe(false)
		expect(pool.actionSetHapticFeedback('0', 1000, false)).toBe(false)
		expect(pool.actionSetHapticFeedback('missing', 'down', false)).toBe(false)

		expect(pool.actionSetHapticFeedback('0', 'down', false)).toBe(true)
		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toEqual(['down'])
		expect(pool.actionSetHapticFeedback('0', 'down', true)).toBe(true)
		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toBeUndefined()
	})

	test('does not report a change when the requested preference already matches', () => {
		const { pool, reportChange } = createPool()

		reportChange.mockClear()
		expect(pool.actionSetHapticFeedback('0', 'down', true)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()

		expect(pool.actionSetHapticFeedback('0', 'down', false)).toBe(true)
		expect(reportChange).toHaveBeenCalledTimes(1)

		reportChange.mockClear()
		expect(pool.actionSetHapticFeedback('0', 'down', false)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()

		expect(pool.actionSetHapticFeedback('0', 'down', true)).toBe(true)
		expect(reportChange).toHaveBeenCalledTimes(1)

		reportChange.mockClear()
		expect(pool.actionSetHapticFeedback('0', 'down', true)).toBe(true)
		expect(reportChange).not.toHaveBeenCalled()
	})

	test('renames and removes duration metadata with the action group', () => {
		const { pool } = createPool()
		pool.actionSetAdd('0')
		pool.actionSetRunWhileHeld('0', 1000, true)
		pool.actionSetHapticFeedback('0', 1000, false)

		expect(pool.actionSetRename('0', 1000, 1250)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toEqual([1250])
		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toEqual([1250])
		expect(pool.isActionSetHapticFeedbackEnabled('0', 1250)).toBe(false)

		expect(pool.actionSetRemove('0', 1250)).toBe(true)
		expect(pool.getStepActions('0')?.options.runWhileHeld).toEqual([])
		expect(pool.getStepActions('0')?.options.hapticDisabledSets).toBeUndefined()
	})

	test('duplicates preferences independently and leaves them unchanged when copying an action leaf', () => {
		const { pool } = createPool()
		pool.entityAdd(downSet(), null, actionModel())
		pool.actionSetHapticFeedback('0', 'down', false)

		expect(pool.stepDuplicate('0')).toBe(true)
		expect(pool.actionSetHapticFeedback('0', 'down', true)).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('1', 'down')).toBe(false)

		const copiedActionId = pool.getAllEntitiesInList(downSet('1'))[0]?.id
		expect(copiedActionId).toBeTruthy()
		expect(pool.entityDuplicate(downSet('1'), copiedActionId)).toBe(true)
		expect(pool.isActionSetHapticFeedbackEnabled('1', 'down')).toBe(false)
	})

	test('keeps preference editing unavailable on read-only pools', () => {
		const pool = new ControlEntityListPoolButton(createPoolDeps({ controlId: 'readonly' }).deps, vi.fn(), true)

		expect(pool.isActionSetHapticFeedbackEnabled('0', 'down')).toBe(true)
		// @ts-expect-error actionSetHapticFeedback is only on the editable pool
		expect(typeof pool.actionSetHapticFeedback).toBe('undefined')
	})
})
