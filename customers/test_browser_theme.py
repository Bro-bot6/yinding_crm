from types import SimpleNamespace

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase
from django.urls import resolve


class BrowserThemeDeliveryTests(SimpleTestCase):
    def test_authenticated_html_revalidates_and_references_new_assets(self):
        request = RequestFactory().get('/')
        request.user = SimpleNamespace(is_authenticated=True, is_superuser=False)
        response = resolve('/').func(request)
        response.render()
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn('no-cache', response['Cache-Control'])
        for asset, version in (
            ('style.css', '20260923-1'),
            ('liquid-glass.css', '20260923-1'),
            ('app.js', '20261008-1'),
        ):
            self.assertContains(response, f'{asset}?v={version}')

    def test_login_redirect_is_not_cached(self):
        request = RequestFactory().get('/')
        request.user = AnonymousUser()
        response = resolve('/').func(request)
        self.assertEqual(response.status_code, 302)
        self.assertIn('no-store', response['Cache-Control'])
