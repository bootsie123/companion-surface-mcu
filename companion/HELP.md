## Mackie Control RTP MIDI

This surface module lets Companion connect to Mackie Control-compatible devices over RTP MIDI. Once connected, the device is exposed as a Companion remote surface so its buttons, encoders, faders, displays, meters, and other controls can be mapped and used as normal.

## Requirements

This module requires at least **Companion version >5.1.0** (currently in beta)

## Setup

Once the module is installed in Companion, a new remote surface can be added by going to `Surfaces > Remote` and clicking on `Add Remote Surface Connection` and choosing `mcu-rtp-midi`. Afterwards, enter the connection details for the device/RTP MIDI endpoint.

Surface Configuration:

| Field      | Description                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IP Address | The IP address Companion should connect to for the RTP MIDI session                                                                                     |
| Port       | The RTP MIDI port used by the device. Most setups use `5004` (default)                                                                                  |
| Layout     | Chooses how the surface is mapped to the Companion grid. Pick the layout that best matches your device. Alternate layouts are available for each device |

If you are unsure which layout to use, start with `X-Touch`. The combined segment-display variant can be used to control the segment display as one large display instead of multiple individual segments.

### X-Touch Setup

When using a Behringer X-Touch, the device must be configured in MC network slave mode. This mode exposes the X-Touch as an MCU compatible device over the network through RTP MIDI.

This can be configured through the following steps:

1. With the X-Touch off, hold down the select button found in the channel 1 channel strip and then continue holding it while powering on the X-Touch
2. A settings menu should appear on the LCD displays. Make sure the settings are configured as shown below:

   | Name    | Value   |
   | ------- | ------- |
   | Mode    | MC      |
   | Ifc     | Network |
   | Network | Mode    |
   | Role    | SLAVE   |
   | Port    | 5004    |

   DHCP can also be turned on at this stage if desired. The LCD brightness can also be adjusted here too.

3. Once the settings are configured to your liking, press the select button colored green to confirm

4. The LCD displays will show the devices IP. Make sure the device is on the same network as Companion

5. From within Companion, use the shown IP on the device for the `IP Address` setting of the remote surface. Make sure the `Port` setting is set to the same port as configured in step 2 (most likely 5004).

## Supported Layouts

- X-Touch
- X-Touch (Combined Segment Displays)
  ![X-Touch Layout](./images/xtouch.png)

- MCU Pro
- MCU Pro (Combined Segment Displays)
  ![MCU Pro Layout](./images/mcu-pro.png)

## Pincodes

All layouts support unlocking the surface through a pincode. Please refer to the following table for how each number is mapped:

| Digit | Button Label |
| ----- | ------------ |
| 0     | Global View  |
| 1     | F1           |
| 2     | F2           |
| 3     | F3           |
| 4     | F4           |
| 5     | F5           |
| 6     | F6           |
| 7     | F7           |
| 8     | F8           |
| 9     | Flip         |
