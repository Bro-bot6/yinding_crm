"""Keep the CRM reachable when Windows joins Wi-Fi after the server starts."""

from __future__ import annotations

import re
import os
import socket
import subprocess
import threading
import time
from ipaddress import IPv4Address, ip_network

from django.conf import settings
from django.http.request import split_domain_port


LAN_NETWORKS = tuple(ip_network(value) for value in (
    '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12',
))
_cache_lock = threading.Lock()
_cached_addresses: tuple[str, ...] = ()
_cache_until = 0.0


def _lan_address(value: str) -> bool:
    try:
        address = IPv4Address(value)
    except ValueError:
        return False
    return any(address in network for network in LAN_NETWORKS)


def active_lan_ipv4(*, refresh: bool = False) -> tuple[str, ...]:
    """Read active local adapter addresses; ignore proxy and tunnel ranges."""
    global _cached_addresses, _cache_until
    with _cache_lock:
        if not refresh and time.monotonic() < _cache_until:
            return _cached_addresses

        addresses: list[str] = []
        # Windows name resolution can initially return only the proxy adapter.
        # ipconfig reports Wi-Fi's own IPv4 even when the proxy owns the route.
        if os.name == 'nt':
            try:
                output = subprocess.run(
                    ['ipconfig'], capture_output=True, timeout=3, check=True,
                ).stdout
                addresses.extend(match.decode('ascii') for match in re.findall(
                    rb'IPv4[^\r\n]*?((?:\d{1,3}\.){3}\d{1,3})', output,
                ))
            except (OSError, subprocess.SubprocessError):
                pass
        if not addresses:
            try:
                addresses.extend(socket.gethostbyname_ex(socket.gethostname())[2])
            except OSError:
                pass
        _cached_addresses = tuple(dict.fromkeys(value for value in addresses if _lan_address(value)))
        _cache_until = time.monotonic() + 5
        return _cached_addresses


class LocalHostRefreshMiddleware:
    """Allow only this computer's active LAN IP if Wi-Fi appeared after boot."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'AUTO_LOCAL_HOSTS', False):
            raw_host = request.META.get('HTTP_HOST') or request.META.get('SERVER_NAME', '')
            host, _port = split_domain_port(raw_host)
            if host and host not in settings.ALLOWED_HOSTS and host in active_lan_ipv4():
                with _cache_lock:
                    if host not in settings.ALLOWED_HOSTS:
                        settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, host]
        return self.get_response(request)
