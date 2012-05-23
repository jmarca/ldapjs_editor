/* global console require */

/**
 * Module dependencies.
 */

var ldap = require('ldapjs')
var _ = require('underscore')
var async = require('async')


var client = ldap.createClient({
    url: 'ldap://127.0.0.1:1389'

});


// basic idea.  If the user is logged in, then the req has a uid and such.  The user editor is restricted then to editing just that user's information.

// if the user is not logged in, then this module needs to allow for the creation of content from a post.  the post will store the user's details, and then needs to mail an initial password to the user's email address.  use CAS functionality to generate a one-time login token??

// so first, the post handler.  Accept a form, fill out the ldap object, and create

function createNewUser(req,res,next){
    // first bind client
    console.log('loading')
    client.bind('cn=Manager','ctmlabs.net',function(err){
        if(err) next(err);
        // first prevent duplicate uid
        console.log('bind okay');
        var dsn = 'uid='+req.params.uid+',ou=people,dc=ctmlabs,dc=org';
        return query(err,dsn,client,function(err,existing){
                   if(err === undefined || existing !== undefined) {
                       // collision
                       return next(new Error('Duplicate user name'+req.params.uid))
                   }else{
                       // an error in this case is good, means no conflict in db
                       // populate user object
                       var user = {'dn':dsn
                                  ,'objectClass':['top','person','inetOrgPerson']
                                  ,'controls':[]};
                       user.uid=req.params.uid;
                       user.mail=req.params.mail
                       user.givenName=req.params.givenName;
                       user.sn=req.params.sn;
                       user.userPassword=req.params.password;
                       user.cn=[user.givenName,user.sn].join(' ');
                       return client.add(user.dn,user,function(err){
                                  if(err)next(err);
                                  next(null,user)
                              });
                   }
               });
    });
    return null;
}

function query (err,dsn,client,next){
    if(err) next(err)
    var output;
    console.log('checking for '+dsn);
    client.search(dsn, {'scope':'sub'}, function(err, res) {
        if(err) next(err);
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
                next(null,output);
            }
        });

    });
}
function loadUser(req,res,next){
    // first bind client
    console.log('loading')
    client.bind('cn=Manager','ctmlabs.net',function(err){
        if(err) next(err);
        console.log('bind okay');
        var dsn = 'uid='+req.uid+',ou=people,dc=ctmlabs,dc=org';
        query(err,dsn,client,function(err,user){
            console.log('done with query')
            console.log(user)
            next(err,user)
        });
    })
}


export.loadUser=loadUser;
