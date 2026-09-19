import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockDeep } from 'vitest-mock-extended'
import type { IpcWrapper } from '../../lib/Instance/Common/IpcWrapper.js'
import type {
	HostOpenDeviceResult,
	HostToSurfaceModuleEvents,
	SurfaceModuleToHostEvents,
} from '../../lib/Instance/Surface/IpcTypes.js'
import LogController, { type Logger } from '../../lib/Log/Controller.js'
import { createOrSanitizeSurfaceHandlerConfig } from '../../lib/Surface/Config.js'
import type { SurfaceController } from '../../lib/Surface/Controller.js'
import { SurfaceHandler } from '../../lib/Surface/Handler.js'
import { SurfacePluginPanel } from '../../lib/Surface/PluginPanel.js'
import type { SurfaceHandlerDependencies } from '../../lib/Surface/Types.js'

function makePanel(connectionId: string | null) {
	const ipc = mockDeep<IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>>()
	ipc.sendWithCb.mockResolvedValue(undefined)
	const info: HostOpenDeviceResult = {
		surfaceId: 'test:deck',
		description: 'Test deck',
		supportsBrightness: false,
		hapticFeedback: connectionId ? { connectionId } : undefined,
		surfaceLayout: {
			stylePresets: { default: { bitmap: { w: 1, h: 1 } } },
			controls: { key: { row: 0, column: 0 } },
		},
		transferVariables: null,
		location: null,
		isRemote: false,
		configFields: null,
	}
	const panel = new SurfacePluginPanel(ipc, 'test-instance', info, vi.fn())
	return { panel, ipc }
}

function makeHandler(connectionId: string | null) {
	const { panel, ipc } = makePanel(connectionId)
	vi.spyOn(panel, 'draw').mockImplementation(() => {})
	const surfaces = mockDeep<SurfaceController>()
	const deps = mockDeep<SurfaceHandlerDependencies>()
	deps.userconfig.getKey.mockImplementation((key: string) => (key === 'pin' ? '1234' : undefined))
	deps.pageStore.getFirstPageId.mockReturnValue('page1')
	deps.pageStore.getPageNumber.mockReturnValue(1)
	deps.pageStore.getPageCount.mockReturnValue(2)
	deps.pageStore.getControlIdAt.mockReturnValue('control1')
	const config = createOrSanitizeSurfaceHandlerConfig('test', panel, undefined, {
		minColumn: 0,
		maxColumn: 7,
		minRow: 0,
		maxRow: 3,
	})
	const handler = new SurfaceHandler(surfaces, deps, new EventEmitter(), panel, config)
	return { panel, ipc, handler, deps }
}

describe('haptic surface routing', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => {
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	test('panel sends the captured generation and drops mismatched, closed and legacy requests', () => {
		const { panel, ipc } = makePanel('open1')
		panel.triggerHapticFeedback('open1')
		expect(ipc.sendWithCb).toHaveBeenCalledWith('triggerHapticFeedback', {
			surfaceId: 'test:deck',
			connectionId: 'open1',
		})
		panel.triggerHapticFeedback('old-open')
		expect(ipc.sendWithCb).toHaveBeenCalledTimes(1)
		panel.quit()
		ipc.sendWithCb.mockClear()
		panel.triggerHapticFeedback('open1')
		expect(ipc.sendWithCb).not.toHaveBeenCalled()
		const legacy = makePanel(null)
		legacy.panel.triggerHapticFeedback('open1')
		expect(legacy.ipc.sendWithCb).not.toHaveBeenCalled()
	})

	test('panel contains synchronous and asynchronous IPC failures', async () => {
		const logger = mockDeep<Logger>()
		const createLogger = vi.spyOn(LogController, 'createLogger').mockReturnValue(logger)
		const { panel, ipc } = makePanel('open1')
		createLogger.mockRestore()
		ipc.sendWithCb.mockImplementationOnce(() => {
			throw new Error('closed')
		})
		expect(() => panel.triggerHapticFeedback('open1')).not.toThrow()
		ipc.sendWithCb.mockRejectedValueOnce(new Error('disconnected'))
		panel.triggerHapticFeedback('open1')
		await vi.waitFor(() => expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('disconnected')))
		expect(logger.debug).toHaveBeenCalledTimes(2)
	})

	test('release reuses the physical context and original location after a page and offset change', () => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		expect(context).toBeTruthy()
		context?.request('down')
		handler.storeNewDevicePage('page2', true)
		deps.pageStore.getPageNumber.mockReturnValue(2)
		handler.setPosition(3, 2)
		panel.inputPress('key', false)
		expect(deps.controls.pressControl.mock.lastCall?.[3]).toBe(context)
		expect(deps.pageStore.getControlIdAt).toHaveBeenLastCalledWith({ pageNumber: 1, column: 0, row: 0 })
		context?.request('held')
		expect(ipc.sendWithCb.mock.calls.filter(([type]) => type === 'triggerHapticFeedback')).toHaveLength(1)
	})

	test.each(['replace', 'lock', 'unload'] as const)('%s invalidates a pending gesture', (reason) => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		expect(context).toBeTruthy()
		if (reason === 'replace') panel.inputPress('key', true)
		else if (reason === 'lock') handler.setLocked(true, true)
		else handler.unload()
		context?.request('held')
		expect(ipc.sendWithCb.mock.calls.filter(([type]) => type === 'triggerHapticFeedback')).toHaveLength(0)
	})

	test('release still invalidates the cue when the current page no longer exists', () => {
		const { panel, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		const context = deps.controls.pressControl.mock.lastCall?.[3]
		deps.pageStore.getPageNumber.mockReturnValue(null)
		panel.inputPress('key', false)
		context?.request('held')
		expect(ipc.sendWithCb.mock.calls.filter(([type]) => type === 'triggerHapticFeedback')).toHaveLength(0)
	})

	test('plain input, rotary, PIN and legacy input never directly request output', () => {
		const { panel, handler, deps, ipc } = makeHandler('open1')
		panel.inputPress('key', true)
		panel.inputRotate('key', 1)
		handler.setLocked(true, true)
		panel.inputPress('key', true)
		panel.inputPincode(1)
		expect(deps.controls.pressControl).toHaveBeenCalledTimes(1)
		expect(ipc.sendWithCb.mock.calls.filter(([type]) => type === 'triggerHapticFeedback')).toHaveLength(0)
		const legacy = makeHandler(null)
		legacy.panel.inputPress('key', true)
		expect(legacy.deps.controls.pressControl.mock.lastCall?.[3]).toBeNull()
	})

	test('explicit requests use the current panel generation', () => {
		const { handler, ipc } = makeHandler('open2')
		handler.triggerHapticFeedback()
		expect(ipc.sendWithCb).toHaveBeenCalledWith('triggerHapticFeedback', {
			surfaceId: 'test:deck',
			connectionId: 'open2',
		})
	})
})
