import { describe, expect, test, vi } from 'vitest'
import { ButtonHapticFeedback } from '../../lib/Controls/ButtonHapticFeedback.js'

describe('ButtonHapticFeedback', () => {
	test('suppresses an ordinary release echo after a down request', () => {
		const send = vi.fn()
		const feedback = new ButtonHapticFeedback(send)

		feedback.request('down')
		feedback.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('allows an up request when no earlier automatic request was made', () => {
		const send = vi.fn()
		const feedback = new ButtonHapticFeedback(send)

		feedback.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('allows each distinct held-stage request while still suppressing up', () => {
		const send = vi.fn()
		const feedback = new ButtonHapticFeedback(send)

		feedback.request('down')
		feedback.request('held')
		feedback.request('held')
		feedback.request('up')

		expect(send).toHaveBeenCalledTimes(3)
	})

	test('finish prevents later requests', () => {
		const send = vi.fn()
		const feedback = new ButtonHapticFeedback(send)

		feedback.request('down')
		feedback.finish()
		feedback.request('held')
		feedback.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})

	test('contains a synchronous send exception and still records the attempt', () => {
		const send = vi.fn(() => {
			throw new Error('device unavailable')
		})
		const feedback = new ButtonHapticFeedback(send)

		expect(() => feedback.request('down')).not.toThrow()
		feedback.request('up')

		expect(send).toHaveBeenCalledTimes(1)
	})
})
