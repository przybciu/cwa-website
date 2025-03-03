const removeTrailingSlash = (str) => {
  if (str.endsWith('/')) {
    str = str.slice(0, -1);
  }
  return str;
}

Cypress.Commands.add('expectPathToBe', (pathToCheck, timeout = undefined) =>
  cy.location({ timeout }).should(location => {
    expect(removeTrailingSlash(location.pathname)).to.eq(removeTrailingSlash(pathToCheck));
  })
);

Cypress.Commands.add('testFaqRedirect', (lang, from, to) => {
  cy.log("Test FAQ redirect from " + from + " to " + to);
  cy.visit("/" + lang) // workaround to visit homepage between redirect tests
    .then(() => {
      cy.visit("/" + lang + "/faq/results/" + from)
        .then(() => {
          cy.hash().should('eq', to);
        });
    });
});

//overide application error
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from
  // failing the test
  console.log("App TypeError")
  console.log(err)
  return false
})

// soft assert for finding broken links, see also check_links.js
let isSoftAssertion = false;
let errors = [];

chai.softExpect = function ( ...args ) {
    isSoftAssertion = true;
    return chai.expect(...args);
},
chai.softAssert = function ( ...args ) {
    isSoftAssertion = true;
    return chai.assert(...args);
}

const origAssert = chai.Assertion.prototype.assert;
chai.Assertion.prototype.assert = function (...args) {
    if ( isSoftAssertion ) {
        try {
            origAssert.call(this, ...args)
        } catch ( error ) {
            errors.push(error);
        }
        isSoftAssertion = false;
    } else {
        origAssert.call(this, ...args)
    }
};

// monkey-patch `Cypress.log` so that the last `cy.then()` isn't logged to command log
const origLog = Cypress.log;
Cypress.log = function ( data ) {
    if ( data && data.error && /soft assertions/i.test(data.error.message) ) {
        data.error.message = '\n\n\t' + data.error.message + '\n\n';
        throw data.error;
    }
    return origLog.call(Cypress, ...arguments);
};

// monkey-patch `it` callback so we insert `cy.then()` as a last command 
// to each test case where we'll assert if there are any soft assertion errors
function itCallback ( func ) {
    func();
    cy.then(() => {
        if ( errors.length ) {
            const _ = Cypress._;
            let msg = '';

            if ( Cypress.browser.isHeaded ) {
                msg = 'Failed soft assertions... check log above ↑';
            } else {
                _.each( errors, error => {
                    msg += 'n' + error;
                });
                msg = msg.replace(/^/gm, 't');
            }
            throw new Error(msg);
        }
    });
}

const origIt = window.it;
window.it = (title, func) => {
  origIt(title, func && (() => itCallback(func)));
};
window.it.only = (title, func) => {
  origIt.only(title, func && (() => itCallback(func)));
};
window.it.skip = (title, func) => {
  origIt.skip(title, func);
};
beforeEach(() => {
  errors = [];
});
afterEach(() => {
  errors = [];
  isSoftAssertion = false;
});
