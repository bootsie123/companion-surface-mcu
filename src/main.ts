import {
	createModuleLogger,
	type DetectionSurfaceInfo,
	type OpenSurfaceResult,
	type SurfaceContext,
	type SurfacePlugin,
} from '@companion-surface/base'
import { MCURemoteService } from './remote.js'
import { MCUInstance } from './instance.js'
import type { ConcreteLayout } from './layouts/manager.js'

export interface MCUDeviceInfo {
	ip: string
	port: number
	stream: any
	layout: ConcreteLayout
}

const remoteService = new MCURemoteService()

const logger = createModuleLogger('MCU Plugin')

/**
 * Companion surface plugin.
 */
export const plugin: SurfacePlugin<MCUDeviceInfo> = {
	remote: remoteService,

	/**
	 * Initializes the remote service used by the plugin.
	 *
	 * @returns A promise that resolves when initialization is complete.
	 */
	init: async (): Promise<void> => {
		await remoteService.init()
	},

	/**
	 * Tears down the remote service used by the plugin.
	 *
	 * @returns A promise that resolves when shutdown is complete.
	 */
	destroy: async (): Promise<void> => {
		await remoteService.destroy()
	},

	/**
	 * Scans for connected MCU-compatible surfaces.
	 *
	 * @returns A promise that resolves to the detected surfaces.
	 */
	scanForSurfaces: async (): Promise<DetectionSurfaceInfo<MCUDeviceInfo>[]> => {
		return remoteService.scanForSurfaces()
	},

	/**
	 * Opens a detected surface and builds its registration metadata.
	 *
	 * @param surfaceId The surface id
	 * @param pluginInfo The device metadata associated with the surface
	 * @param context The Companion surface context
	 *
	 * @returns A promise that resolves to the opened surface and registration data
	 */
	openSurface: async (
		surfaceId: string,
		pluginInfo: MCUDeviceInfo,
		context: SurfaceContext,
	): Promise<OpenSurfaceResult> => {
		logger.info(`Opening new surface: ${surfaceId} (${pluginInfo.ip}:${pluginInfo.port})`)

		const surface = new MCUInstance(surfaceId, pluginInfo, context)

		return {
			surface,
			registerProps: {
				brightness: false,
				surfaceLayout: surface.layout.getLayoutDefinition(),
				pincodeMap: surface.layout.getPincodeMap(),
				location: `${pluginInfo.ip}:${pluginInfo.port}`,
				configFields: surface.getConfigFields(),
				transferVariables: surface.layout.getTransferVariables(),
			},
		}
	},
}

export default plugin
