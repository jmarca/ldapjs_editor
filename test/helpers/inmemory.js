var ldap = require('ldapjs');
var fs = require('fs')
var _ = require('underscore')
var async = require('async')

var env = process.env;
var manager_password = env.LDAP_PASS;

///--- Shared handlers

function authorize(req, res, next) {
  if (!req.connection.ldap.bindDN.equals('cn=Manager'))
    return next(new ldap.InsufficientAccessRightsError());

  return next();
}


///--- Globals

var SUFFIX = 'dc=org';
var db = {};
var server = ldap.createServer();



server.bind('cn=Manager', function(req, res, next) {
  if (req.dn.toString() !== 'cn=Manager' || req.credentials !== manager_password)
    return next(new ldap.InvalidCredentialsError());

  res.end();
  return next();
});

server.add(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
    console.log('adding')

  if (db[dn])
    return next(new ldap.EntryAlreadyExistsError(dn));

    db[dn] = req.toObject().attributes;
    console.log(JSON.stringify(db[dn]))
    res.end();
  return next();
});

server.bind(SUFFIX, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  if (!db[dn].userpassword)
    return next(new ldap.NoSuchAttributeError('userPassword'));

  if (db[dn].userpassword !== req.credentials)
    return next(new ldap.InvalidCredentialsError());

  res.end();
  return next();
});

server.compare(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  if (!db[dn][req.attribute])
    return next(new ldap.NoSuchAttributeError(req.attribute));

  var matches = false;
  var vals = db[dn][req.attribute];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i] === req.value) {
      matches = true;
      break;
    }
  }

  res.end(matches);
  return next();
});

server.del(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  delete db[dn];

  res.end();
  return next();
});

server.modify(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
  if (!req.changes.length)
    return next(new ldap.ProtocolError('changes required'));
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  var entry = db[dn];

  for (var i = 0; i < req.changes.length; i++) {
    mod = req.changes[i].modification;
    switch (req.changes[i].operation) {
    case 'replace':
      if (!entry[mod.type])
        return next(new ldap.NoSuchAttributeError(mod.type));

      if (!mod.vals || !mod.vals.length) {
        delete entry[mod.type];
      } else {
        entry[mod.type] = mod.vals;
      }

      break;

    case 'add':
      if (!entry[mod.type]) {
        entry[mod.type] = mod.vals;
      } else {
        mod.vals.forEach(function(v) {
          if (entry[mod.type].indexOf(v) === -1)
            entry[mod.type].push(v);
        });
      }

      break;

    case 'delete':
      if (!entry[mod.type])
        return next(new ldap.NoSuchAttributeError(mod.type));

      delete entry[mod.type];

      break;
    }
  }

  res.end();
  return next();
});

server.search(SUFFIX, authorize, function(req, res, next) {
  var dn = req.dn.toString();
  if (!db[dn])
    return next(new ldap.NoSuchObjectError(dn));

  var scopeCheck;

  switch (req.scope) {
  case 'base':
    if (req.filter.matches(db[dn])) {
      res.send({
        dn: dn,
        attributes: db[dn]
      });
    }

    res.end();
    return next();

  case 'one':
    scopeCheck = function(k) {
      if (req.dn.equals(k))
        return true;

      var parent = ldap.parseDN(k).parent();
      return (parent ? parent.equals(req.dn) : false);
    };
    break;

  case 'sub':
    scopeCheck = function(k) {
      return (req.dn.equals(k) || req.dn.parentOf(k));
    };

    break;
  }

  Object.keys(db).forEach(function(key) {
    if (!scopeCheck(key))
      return;

    if (req.filter.matches(db[key])) {
      res.send({
        dn: key,
        attributes: db[key]
      });
    }
  });

  res.end();
  return next();
});






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



function createRecordLoader(client,next){
    return function(err,records){
        if(err)
            return next(err)

        // expecting an array of ldap objects
        async.forEachSeries(records
                           ,function(entry,callback){
                                return client.add(entry.dn, entry, function(err) {
                                           if(err){
                                               console.log(JSON.stringify(err))
                                               console.log('choked on ' + JSON.stringify(entry))
                                               callback(err);
                                           }
                                           callback()
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
    console.log('reading file '+filename)
    // read json records from file
    fs.readFile(filename, function (err, data) {
        if(err) return next(err)
        var records = JSON.parse(data)
        return next(null,records)
    });
    return null
}


///--- Fire it up

server.listen(1389, function() {
  console.log('LDAP server up at: %s', server.url);
    var client = ldap.createClient({
        url: 'ldap://127.0.0.1:1389'
    });
    function binder( client ){
        return function ( next ){
            client.bind('cn=Manager',manager_password,function(err){
                if(err) next(err);
                console.log('bind okay');
                next()
            });
        }
    }

    async.series([binder(client)
                 ,function(cb){
                      var loadRecords = createRecordLoader(client,cb)
                      loadFile(null,'./test/helpers/ldap.all.json',loadRecords)
                  }
             ]);
});


