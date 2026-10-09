const test = require('node:test');
const assert = require('node:assert/strict');
const { bindLogoutButton, paintProfile } = require('./assets/js/profile-ui');

function buttonStub() {
  return {
    disabled: false,
    addEventListener(eventName, handler) {
      assert.equal(eventName, 'click');
      this.handler = handler;
    }
  };
}

test('profile displays the account name and email and fills editable details', () => {
  const elements = {
    name: { textContent: '' },
    email: { textContent: '' },
    initials: { textContent: '' },
    firstName: { value: '' },
    lastName: { value: '' },
    phone: { value: '' }
  };

  paintProfile({
    firstName: 'Tharuka', lastName: 'Prabathiya',
    email: 'tharukaprabathiya@gmail.com', phone: '0771234567'
  }, elements, user => `${user.firstName[0]}${user.lastName[0]}`);

  assert.equal(elements.name.textContent, 'Tharuka Prabathiya');
  assert.equal(elements.email.textContent, 'tharukaprabathiya@gmail.com');
  assert.equal(elements.initials.textContent, 'TP');
  assert.equal(elements.firstName.value, 'Tharuka');
  assert.equal(elements.lastName.value, 'Prabathiya');
  assert.equal(elements.phone.value, '0771234567');
});

test('successful logout redirects to the signup page', async () => {
  const button = buttonStub();
  const statuses = [];
  const destinations = [];
  let logoutRequests = 0;

  bindLogoutButton(button, {
    apiRequest: async (path, options) => {
      logoutRequests += 1;
      assert.equal(path, '/api/auth/logout');
      assert.equal(options.method, 'POST');
    },
    showStatus: (...args) => statuses.push(args),
    navigate: path => destinations.push(path),
    confirmLogout: () => true
  });

  await button.handler();

  assert.equal(logoutRequests, 1);
  assert.deepEqual(destinations, ['auth.html?tab=signup']);
  assert.equal(button.disabled, true);
});

test('failed logout stays on profile, reports the error, and re-enables the button', async () => {
  const button = buttonStub();
  const statuses = [];
  const destinations = [];

  bindLogoutButton(button, {
    apiRequest: async () => { throw new Error('server unavailable'); },
    showStatus: (...args) => statuses.push(args),
    navigate: path => destinations.push(path),
    confirmLogout: () => true
  });

  await button.handler();

  assert.deepEqual(destinations, []);
  assert.equal(button.disabled, false);
  assert.match(statuses.at(-1)[0], /server unavailable/);
  assert.equal(statuses.at(-1)[1], 'error');
});

test('cancelled logout does not call the API', async () => {
  const button = buttonStub();
  let logoutRequests = 0;

  bindLogoutButton(button, {
    apiRequest: async () => { logoutRequests += 1; },
    showStatus() {},
    navigate() {},
    confirmLogout: () => false
  });

  await button.handler();
  assert.equal(logoutRequests, 0);
  assert.equal(button.disabled, false);
});
