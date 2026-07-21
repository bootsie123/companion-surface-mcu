import { DecodeStream } from '@lachenmayer/midi-messages'

/**
 * Represents a MIDI message, which can be a NoteOn, ControlChange, PitchBendChange, SysEx, or other MIDI message types
 */
type MidiMessage = Parameters<typeof DecodeStream.prototype._onmessage>[0]

export default MidiMessage
