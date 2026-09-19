import LogController from '../Log/Controller.js'

const logger = LogController.createLogger('Controls/ButtonHapticFeedback')

/** Feedback eligibility for one physical press, shared by transparent button references. */
export class ButtonHapticFeedback {
	readonly #send: () => void
	#active = true
	#hasAutomaticRequest = false

	constructor(send: () => void) {
		this.#send = send
	}

	request(phase: 'down' | 'held' | 'up'): void {
		if (!this.#active || (phase === 'up' && this.#hasAutomaticRequest)) return

		// Record the attempt before sending, without depending on device acknowledgement.
		this.#hasAutomaticRequest = true
		try {
			this.#send()
		} catch (e) {
			logger.debug(`Haptic feedback failed: ${e}`)
		}
	}

	finish(): void {
		this.#active = false
	}
}
