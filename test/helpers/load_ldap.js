/* global require console process JSON */

var ldap = require('ldapjs')
var fs = require('fs')
var _ = require('underscore')
var async = require('async')

var client = ldap.createClient({
    url: 'ldap://127.0.0.1:1389'

});


function binder( next ){
    client.bind('cn=Manager','ctmlabs.net',function(err){
        if(err) next(err);
        console.log('bind okay');
        next()
    });
}

//  -D cn=Manager,dc=ctmlabs,dc=org -w ctmlabs.net -b ou=people,dc=ctmlabs,dc=org memberOf
// var options = {scope:'base'
//               ,filter	A string version of an LDAP filter (see below), or a programatically constructed Filter object. Defaults to (objectclass=*).
// attributes	attributes to select and return (if these are set, the server will return only these attributes). Defaults to the empty set, which means all attributes.
// attrsOnly	boolean on whether you want the server to only return the names of the attributes, and not their values. Borderline useless. Defaults to false.
// sizeLimit	the maximum number of entries to return. Defaults to 0 (unlimited).
// timeLimit	the maximum amount of time the server should take in responding, in seconds. Defaults to 10. Lots of servers will ignore this.


function querycheck (err,next){
    console.log('checking to see if data was written properly')
    if(err){
        console.log(err);
        if(next)  next(err)
        return null;
    }
    client.search('ou=people,dc=ctmlabs,dc=org', {'scope':'sub'}, function(err, res) {
        if(err) return next(err);
        var output=[];
        res.on('searchEntry', function(entry) {
            output.push(entry.object)
        });
        res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
            return next(err);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
            console.log(JSON.stringify(output));
            client.unbind();
        });
        return null;
    });
}


var loadRecords = createRecordLoader(client,querycheck)


function createRecordLoader(client,next){
    return function(err,records){
        if(err)
            return next(err)

        // expecting an array of ldap objects
        async.forEachSeries(records
                           ,function(entry,callback){
                                console.log(entry)
                                return client.add(entry.dn, entry, function(err) {
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
                                next(err)
                            })
        return null;
    }
}

function loadFile(err,filename,next){
    if(err) return next(err)
    console.log('rading file '+filename)
    // read json records from file
    fs.readFile(filename, function (err, data) {
        if(err) return next(err)
        var records = JSON.parse(data)
        return next(null,records)
    });
    return null
}


async.series([binder
             ,loadFile(null,'./test/helpers/ldap.all.json',loadRecords)
             ]);
