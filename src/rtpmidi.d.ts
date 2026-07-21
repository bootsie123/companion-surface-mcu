declare module 'rtpmidi' {
	/**
	 * Represents a control message received from an RTP MIDI stream
	 */
	export interface ControlMessage {
		buffer: Buffer | undefined
		start: number
		command: string
		ssrc: number
		count: number
		padding: number
		timestamp1: Buffer
		timestamp2: Buffer
		timestamp3: Buffer
	}

	/**
	 * Exposed manager for RTP MIDI connections
	 */
	export const manager: any
}
