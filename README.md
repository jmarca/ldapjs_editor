# LDAPJS Editor helper library

This library is designed to help create new accounts and edit the
details.  It also creates groups and modifies membership.

# Environment variables

Most of the parameter for using this library should be set by using
environment variables.  This is because I don't like embedding
passwords and such into source code.  For running the library, the
following environment variables must be set

* `LDAP_DN`  the LDAP manager dn
* `LDAP_PASS` the LDAP manager password
* `LDAP_USER_POSTFIX` that bit at the end of the user DSN.  For
  example 'ou=people,dc=ctmlabs,dc=org' would make the user 'jmarca'
  show up as 'uid=jmarca,ou=people,dc=ctmlabs,dc=org'
* `LDAP_GROUP_POSTFIX` the bit at the end of the group DSN.  For
  example 'ou=groups,dc=ctmlabs,dc=org' would mean that the group
  'authors' would show up as 'cn=authors,ou=groups,dc=ctmlabs,dc=org'


Optional environment variables are

* `LDAP_HOST` defaults to localhost, or  '127.0.0.1'
* `LDAP_PORT` defaults to the non-privileged port  1389.  Typically
  ldap servers are run on port 389, but a common setup is to tunnel to
  389 on your ldap server using port 1389 on your local machine.


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

    export LDAP_DN='cn=Manager,dc=ctmlabs,dc=org'
    export LDAP_PASS='secret password'
    export LDAP_HOST='127.0.0.1'
    export LDAP_PORT=389
    export LDAP_USER_EMAIL='brooke@example.net'
    export LDAP_USER_POSTFIX='ou=people,dc=ctmlabs,dc=org'
    export LDAP_GROUP_POSTFIX='ou=groups,dc=ctmlabs,dc=org'


Then run the tests.

    make test



