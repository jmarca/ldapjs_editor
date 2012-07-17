# LDAPJS Editor helper library

This library is designed to help create new accounts and edit the
details.  It also creates groups and modifies membership.

# Testing

To run the tests, some environment variables need to be set, and you
must be running an in memory ldap server.

First use npm to install the dependencies.

   npm install .


You'll need two terminal sessions to run the tests.  In one terminal,
export a password for the ldap server as follows:

    export LDAP_PASS='secret password'

Then load up the in-memory server by running

    node test/helpers/inmemory.js


Next open another terminal, and again export the LDAP_PASS variable,
plus some others:

    export LDAP_DN='cn=Manager'
    export LDAP_PASS='secret password'
    export MAILER_FROM='james@example.net'
    export MAILER_HOST='example.net'
    export LDAP_USER_EMAIL='brooke@example.net'

where the mailer from is your email address,  the mailer host is
your SMTP server host, and the user email entry is the account you
wish to use for the new account creation and password reset tests.

Then run the tests.

    make test

Okay, hackity hack, that was for the local tests, which I've now moved
out of the way.  The current tests under the test directory are for a
live openldap server

    export LDAP_DN='cn=Manager,dc=ctmlabs,dc=org'
    export LDAP_HOST='auth.ctmlabs.net'
    export LDAP_PORT=389
    export LDAP_PASS='ldapManagerPassword'
    export MAILER_FROM='james@example.net'
    export LDAP_USER_EMAIL='brooke@example.net'

