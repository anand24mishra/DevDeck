# P4-4: Mobile testing helper

Design only. For a listening development server, offer a LAN address and locally generated QR code. Explain whether the server is bound to loopback or to an interface reachable by another device; do not suggest a LAN URL for a loopback-only listener.

Choose among active local interfaces explicitly when VPNs, Ethernet and Wi-Fi coexist. Include only the selected IP and port in the QR payload. Never publish a tunnel, change firewall rules, change a server bind address or contact a QR service. Warn that the address is reachable by other devices on that network. Avoid persisting interface addresses in diagnostics.

Use a validated local HTTP URL builder separate from the current localhost-only opener. The existing URL IPC allowlist must not be broadened silently. Test IPv4, IPv6, no network, VPN routing, changing interfaces and phone connectivity. No LAN or QR implementation is included.
