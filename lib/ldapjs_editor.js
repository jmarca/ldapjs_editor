/**
 * Module dependencies.
 */

var express = require('express');
var ldap = require('ldapjs')
var _ = require('underscore')
var async = require('async')

var cas = require('cas_validate');

var app = express.createServer();


var client = ldap.createClient({
    url: 'ldap://127.0.0.1:1389'

});

function loadUser(req, res, next) {
    var output;
  // You would fetch your user from the db
    client.search('uid=jmarca,ou=people,dc=ctmlabs,dc=org', {'scope':'sub'}, function(err, res) {
            ifError(err);

            res.on('searchEntry', function(entry) {
                output = entry.object
            });
            res.on('searchReference', function(referral) {
                console.log('referral: ' + referral.uris.join());
            });
            res.on('error', function(err) {
                console.error('error: ' + err.message);
            });
            res.on('end', function(result) {
                console.log('status: ' + output);
                // client.unbind();
                if(output === undefined){
                    next(new Error('Failed to load user ' + req.params.id));
                }else{
                    next();
                }
            });

        });
}

function andRestrictToSelf(req, res, next) {
  // If our authenticated user is the user we are viewing
  // then everything is fine :)
  if (req.authenticatedUser.id == req.user.id) {
    next();
  } else {
    // You may want to implement specific exceptions
    // such as UnauthorizedError or similar so that you
    // can handle these in app.error() specifically
    // (view ./examples/pages for this)
    next(new Error('Unauthorized'));
  }
}

function andRestrictTo(role) {
  return function(req, res, next) {
    if (req.authenticatedUser.role == role) {
      next();
    } else {
      next(new Error('Unauthorized'));
    }
  }
}

var client = ldap.createClient({
    url: 'ldap://127.0.0.1:1389'

});

// first load up the stored data
client.bind('cn=Manager','ctmlabs.net',function(err){
    ifError(err);
    console.log('bind okay');

    function querycheck (err){
        console.log('checking to see if data was written properly')
        ifError(err)
        client.search('ou=people,dc=ctmlabs,dc=org', {'scope':'sub'}, function(err, res) {
            ifError(err);

            var output=[];
            res.on('searchEntry', function(entry) {
                output.push(entry.object)
            });
            res.on('searchReference', function(referral) {
                console.log('referral: ' + referral.uris.join());
            });
            res.on('error', function(err) {
                console.error('error: ' + err.message);
            });
            res.on('end', function(result) {
                console.log('status: ' + result.status);
                console.log(JSON.stringify(output));
                client.unbind();
            });

        });
    }


    var loadRecords = createRecordLoader(client,querycheck)
    loadFile(null,'ldap.json',loadRecords);

});


//  -D cn=Manager,dc=ctmlabs,dc=org -w ctmlabs.net -b ou=people,dc=ctmlabs,dc=org memberOf
// var options = {scope:'base'
//               ,filter	A string version of an LDAP filter (see below), or a programatically constructed Filter object. Defaults to (objectclass=*).
// attributes	attributes to select and return (if these are set, the server will return only these attributes). Defaults to the empty set, which means all attributes.
// attrsOnly	boolean on whether you want the server to only return the names of the attributes, and not their values. Borderline useless. Defaults to false.
// sizeLimit	the maximum number of entries to return. Defaults to 0 (unlimited).
// timeLimit	the maximum amount of time the server should take in responding, in seconds. Defaults to 10. Lots of servers will ignore this.

function ifError(err) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  }
}

function createRecordLoader(client,next){
    return function(err,records){
        ifError(err)
        // expecting an array of ldap objects
        async.forEachSeries(records
                           ,function(entry,callback){
                                console.log(entry)
                                return client.add('ou=people,dc=ctmlabs,dc=org', entry, function(err) {
                                           if(err){
                                               console.log('choked on ')
                                               console.log(entry)
                                               callback(err);
                                           }
                                           if(callback) callback()
                                       })
                            }
                           ,function(err){
                                console.log('done with adds')
                                ifError(err)
                                next()
                            })
    }
}

function loadFile(err,filename,next){
    ifError(err)
    console.log('rading file '+filename)
    // read json records from file
    fs.readFile(filename, function (err, data) {
        if(err) return next(err)
        var records = JSON.parse(data)
        return next(null,records)
    });
    return null
}