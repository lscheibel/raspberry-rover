# Rover on pi

## Setup

Donwload and flash raspberian lite

Mount partition and navigate to it: 
- on macos: `cd /Volumes/boot/`

Enable ssh `touch ssh`

Setup Wifi:

`touch wpa_supplicant.conf` \
`nano wpa_supplicant.conf`

```
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=DE

network={
    ssid="<wifi-ssid>"
    psk="<pwd>"
    id_str="<some-id>"
}

network={
    ssid="<wifi-ssid>"
    psk="<pwd>"
    id_str="<some-id>"
}
```

`control + x` > `y` > `[enter]` (save and exit nano)

Unmount and stick into pi.

- Connect to pi via ssh: `ssh -o PubkeyAuthentication=no pi@<local-ip-here>`
- Password is: `raspberry`
- `sudo raspi-config`
  2. P6 Serial Port
  3. no
  4. yes
  5. ok
  6. Finish
  7. reboot


- Google how to disable bluetooth


- `sudo apt install tmux`
- Start tmux: `tmux`
- Start node script: `node ~/rover/build/main.js`
- Detach from session: `control + B` danach `D`

You can now exit the ssh session without terminating the script.

- To reattach just enter: `tmux attach`
- To Exit session just enter `exit` and hit [enter]
