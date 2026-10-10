from unittest.mock import patch

from django.conf import settings
from django.core.exceptions import DisallowedHost
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

from config.local_hosts import LocalHostRefreshMiddleware, _lan_address, active_lan_ipv4


class LocalHostRefreshTests(SimpleTestCase):
    def test_tunnel_address_is_not_treated_as_lan(self):
        self.assertFalse(_lan_address('198.18.0.1'))
        self.assertFalse(_lan_address('127.0.0.1'))
        self.assertTrue(_lan_address('192.168.1.28'))

    @override_settings(AUTO_LOCAL_HOSTS=True, ALLOWED_HOSTS=['localhost'])
    @patch('config.local_hosts.active_lan_ipv4', return_value=('192.168.1.28',))
    def test_wifi_address_added_after_server_started(self, _addresses):
        middleware = LocalHostRefreshMiddleware(lambda request: HttpResponse(request.get_host()))
        response = middleware(RequestFactory().get('/', HTTP_HOST='192.168.1.28:8000'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('192.168.1.28', settings.ALLOWED_HOSTS)

    @override_settings(AUTO_LOCAL_HOSTS=True, ALLOWED_HOSTS=['localhost'])
    @patch('config.local_hosts.active_lan_ipv4', return_value=('192.168.1.28',))
    def test_unrelated_host_stays_rejected(self, _addresses):
        middleware = LocalHostRefreshMiddleware(lambda request: HttpResponse(request.get_host()))
        with self.assertRaises(DisallowedHost):
            middleware(RequestFactory().get('/', HTTP_HOST='192.168.1.29:8000'))
        with self.assertRaises(DisallowedHost):
            middleware(RequestFactory().get('/', HTTP_HOST='198.18.0.1:8000'))

    def test_current_wifi_address_can_be_discovered(self):
        # Resolve current interfaces without requiring the proxy to be off.
        self.assertIsInstance(active_lan_ipv4(refresh=True), tuple)

    @patch('config.local_hosts.socket.gethostbyname_ex', return_value=('host', [], ['198.18.0.1']))
    @patch('config.local_hosts.subprocess.run')
    def test_wifi_wins_when_name_resolution_points_at_tunnel(self, ipconfig, _hostname):
        ipconfig.return_value.stdout = (
            b'IPv4 Address . . . : 198.18.0.1\r\n'
            b'IPv4 Address . . . : 192.168.1.28\r\n'
        )
        self.assertEqual(active_lan_ipv4(refresh=True), ('192.168.1.28',))
