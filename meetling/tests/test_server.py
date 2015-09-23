# Meetling
# Copyright (C) 2015 Meetling contributors
#
# This program is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with this program. If not,
# see <http://www.gnu.org/licenses/>.

# pylint: disable=missing-docstring

import http.client
import json
from urllib.parse import urljoin
from tornado.httpclient import AsyncHTTPClient, HTTPError
from tornado.testing import AsyncTestCase, gen_test
from meetling.server import MeetlingServer

class MeetlingServerTest(AsyncTestCase):
    def setUp(self):
        super().setUp()
        self.server = MeetlingServer(redis_url='15')
        self.server.listen(16160, 'localhost')
        self.server.app.r.flushdb()
        self.meeting = self.server.app.create_meeting('Cat Hangout')
        self.item = self.meeting.create_agenda_item('Purring')

    def request(self, url, **args):
        return AsyncHTTPClient().fetch(urljoin('http://localhost:16160/', url), **args)

    @gen_test
    def test_get_start_page(self):
        yield self.request('/')

    @gen_test
    def test_get_create_meeting_page(self):
        yield self.request('/create-meeting')

    @gen_test
    def test_get_meeting_page(self):
        yield self.request('/meetings/' + self.meeting.id)

    @gen_test
    def test_get_edit_meeting_page(self):
        yield self.request('/meetings/{}/edit'.format(self.meeting.id))

    @gen_test
    def test_post_meetings(self):
        yield self.request('/api/meetings', method='POST', body='{"title": "Cat Hangout"}')

    @gen_test
    def test_post_create_example_meeting(self):
        yield self.request('/api/create-example-meeting', method='POST', body='')

    @gen_test
    def test_get_meeting(self):
        response = yield self.request('/api/meetings/' + self.meeting.id)
        meeting = json.loads(response.body.decode())
        self.assertEqual(meeting.get('__type__'), 'Meeting')

    @gen_test
    def test_get_meeting_id_nonexistent(self):
        with self.assertRaises(HTTPError) as cm:
            yield self.request('/api/meetings/foo')
        self.assertEqual(cm.exception.code, http.client.NOT_FOUND)

    @gen_test
    def test_post_meeting(self):
        yield self.request('/api/meetings/' + self.meeting.id, method='POST',
                           body='{"description": "Bring food!"}')

    @gen_test
    def test_post_meeting_description_bad_type(self):
        with self.assertRaises(HTTPError) as cm:
            yield self.request('/api/meetings/' + self.meeting.id, method='POST',
                               body='{"description": 42}')
        self.assertEqual(cm.exception.code, http.client.BAD_REQUEST)
        error = json.loads(cm.exception.response.body.decode())
        self.assertEqual(error.get('__type__'), 'InputError')

    @gen_test
    def test_get_meeting_items(self):
        yield self.request('/api/meetings/{}/items'.format(self.meeting.id))

    @gen_test
    def test_post_meeting_items(self):
        yield self.request('/api/meetings/{}/items'.format(self.meeting.id), method='POST',
                           body='{"title": "Purring"}')

    @gen_test
    def test_get_agenda_item(self):
        yield self.request('/api/meetings/{}/items/{}'.format(self.meeting.id, self.item.id))

    @gen_test
    def test_post_agenda_item(self):
        yield self.request('/api/meetings/{}/items/{}'.format(self.meeting.id, self.item.id),
                           method='POST', body='{"description": "Good mood!"}')