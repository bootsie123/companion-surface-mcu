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

export const plugin: SurfacePlugin<MCUDeviceInfo> = {
	remote: remoteService,

	init: async (): Promise<void> => {
		await remoteService.init()
	},
	destroy: async (): Promise<void> => {
		await remoteService.destroy()
	},
	scanForSurfaces: async (): Promise<DetectionSurfaceInfo<MCUDeviceInfo>[]> => {
		return remoteService.scanForSurfaces()
	},
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
				pincodeMap: null,
				location: `${pluginInfo.ip}:${pluginInfo.port}`,
				configFields: [],
				transferVariables: surface.layout.getTransferVariables(),
			},
		}
	},
}

export default plugin
