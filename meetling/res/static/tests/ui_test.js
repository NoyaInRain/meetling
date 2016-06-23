/*
 * Meetling
 * Copyright (C) 2015 Meetling contributors
 *
 * This program is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program. If
 * not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;

var expect = require('chai').expect;
var Builder = require('selenium-webdriver').Builder;
var until = require('selenium-webdriver/lib/until');

var WebAPIClient = require('../micro/webapi').WebAPIClient;

var TIMEOUT = 1000;

describe('UI scenarios', function() {
    this.timeout(5 * 60 * 1000);

    var server;
    var browser;

    function createAgendaItem(title, options) {
        options = Object.assign({duration: null, description: null}, options);

        var selector = {css: '.meetling-meeting-items .meetling-agenda-item'};
        return browser.findElements(selector).then(items => {
            browser.findElement({css: '.meetling-meeting-create-agenda-item .action'}).click();
            var form = browser.findElement({css: '.meetling-agenda-item-editor form'});
            form.findElement({name: 'title'}).sendKeys(title);
            if (options.duration) {
                form.findElement({name: 'duration'}).sendKeys(options.duration);
            }
            if (options.description) {
                form.findElement({name: 'description'}).sendKeys(options.description);
            }
            form.findElement({css: 'button'}).click();
            selector = {css: `.meetling-meeting-items .meetling-agenda-item:nth-child(${items.length + 1}) h1`};
            return browser.wait(until.elementLocated(selector), TIMEOUT).getText();

        }).then(text => {
            expect(text).to.contain(title);
        });
    }

    beforeEach(function() {
        execSync('make sample');
        server = spawn('python3', ['-m', 'meetling']);
        server.on('err', err => {
            throw err;
        });

        // make test-ui SELENIUM_REMOTE_URL="https://{user}:{key}@ondemand.saucelabs.com:443/wd/hub" PLATFORM="OS X 10.11"
        browser = process.env.BROWSER || 'firefox';
        var platform = process.env.PLATFORM || null;
        browser = new Builder().withCapabilities({browserName: browser, platform: platform, marionette: true}).build();
    });

    afterEach(function() {
        if (server) {
            server.kill();
        }

        if (browser) {
            return browser.quit();
        }
    });

    xit('User creates meeting', function() {
        // Start to create meeting
        // TODO: Either use Sauce Connect or TUNNEL env variable
        browser.get('http://localhost:8080/');
        browser.wait(until.elementLocated({css: '.meetling-start-create-meeting'}), TIMEOUT).click();

        // Create meeting
        var form = browser.findElement({css: '.meetling-edit-meeting-edit'});
        form.findElement({name: 'title'}).sendKeys('Cat hangout');
        form.findElement({name: 'date'}).click();
        browser.findElement({css: '.is-today .pika-day'}).click();
        form.findElement({name: 'time'}).sendKeys('13:30');
        form.findElement({name: 'location'}).sendKeys('Backyard');
        form.findElement({name: 'description'}).sendKeys('A good place for cats TODO.');
        form.findElement({css: 'button'}).click();
        var h1 = browser.wait(until.elementLocated({css: 'meetling-meeting-page h1'}), TIMEOUT);
        h1.getText().then(text => {
            expect(text).to.contain('Cat hangout');
        });

        // Create agenda items
        createAgendaItem('Eating');
        createAgendaItem('Purring', {duration: 10, description: 'No snooping!'});
        createAgendaItem('Napping');

        // Trash agenda item
        browser.findElement({css: '.meetling-agenda-item-menu .micro-menu-toggle-secondary'}).click();
        browser.findElement({css: '.meetling-agenda-item-trash'}).click();

        // Restore agenda item
        var showTrashedItemsButton = browser.findElement({css: '.meetling-meeting-show-trashed-items'});
        browser.wait(until.elementIsVisible(showTrashedItemsButton), TIMEOUT);
        showTrashedItemsButton.click();
        browser.findElement({css: '.meetling-meeting-trashed-items .meetling-agenda-item-restore'}).click();
        var h1 = browser.wait(until.elementLocated(
            {css: '.meetling-meeting-items .meetling-agenda-item:nth-child(3) h1'}), TIMEOUT);
        h1.getText().then(text => {
            expect(text).to.contain('Eating');
        });

        // Share
        browser.findElement({css: '.meetling-meeting-share'}).click();
        return browser.findElement({css: '.meetling-simple-notification-content'}).getText().then(text => {
            expect(text).to.contain('To share');
        });
    });

    it('User subscribes to meeting', function() {
        browser.get('http://localhost:8080/');
        var button = browser.wait(until.elementLocated({css: '.meetling-start-create-example-meeting'}), TIMEOUT);
        button.click();

        browser.wait(until.elementLocated({css: 'meetling-meeting-page'}), TIMEOUT);

        var api = new WebAPIClient('http://localhost:8080/api');
        var meetingID = null;

        browser.getCurrentUrl().then(url => {
            console.log(url);
            meetingID = url.split('/').pop();
            console.log(meetingID);
            return api.call('POST', '/login');
        }).then(user => {
            console.log(user);
            // TODO api.headers['COOKIEFOO'] = user.auth_secret;
            return api.call('POST', `/meetings/${meetingID}/items`, {title: 'oink'});
        }).then(item => {
            console.log(item);
        }).catch(e => {
            console.log(e);
        });
        return browser.sleep(1);
    });
});