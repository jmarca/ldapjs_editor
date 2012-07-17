var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')
var ssha = require('openldap_ssha')

var express = require('express');

var request = require('supertest');
var async = require('async')

var env = process.env;
var test_email = env.LDAP_USER_EMAIL;

describe('ldapjs_editor',function(){
    it('should not create a duplicate entry',function(done){
        ctmldap.createNewUser({params:{'uid':'jmarca'}},null,function(err,user){
            should.exist(err);
            should.not.exist(user);
            done()
        });
    });
    it('should create and delete a new entry',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble2'
                                      ,'mail':test_email
                                      ,'givenname':'Studly'
                                      ,'sn':'McDude'
                                      }},null,function(err,user,barePassword){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  ctmldap.deleteUser({params:{'uid':'trouble2'}}
                                                                    ,null
                                                                    ,function(err){
                                                                         should.not.exist(err)
                                                                         done()
                                                                     });
                                              });
    });


    it('should create and delete a new entry with camel case',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble'
                                      ,'Mail':test_email
                                      ,'GivenName':'Studly'
                                      ,'SN':'McDude'
                                      }},null,function(err,user,barePassword){
                                                  should.not.exist(err);
                                                  should.exist(user);

                                                  async.series([function(cb){
                                                                    // try to log in with the new account
                                                                    var client = ctmldap.getClient();
                                                                    client.bind(user.dn,barePassword,function(err){
                                                                        console.log(JSON.stringify(err))
                                                                        //should.not.exist(err)
                                                                        var dsn = 'ou=people,dc=ctmlabs,dc=org';
                                                                        ctmldap.query(null,dsn,client,function(err,result){
                                                                            console.log(JSON.stringify(err))
                                                                            console.log(JSON.stringify(result))
                                                                            //should.not.exist(err)
                                                                            //should.exist(result)
                                                                            client.unbind()
                                                                            cb()
                                                                        });
                                                                    });
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.deleteUser({params:{'uid':'trouble'}}
                                                                                      ,null
                                                                                      ,function(err){
                                                                                           should.not.exist(err)
                                                                                           cb()
                                                                                       });
                                                                }]
                                                              ,function(err){
                                                                   should.not.exist(err)
                                                                   done()
                                                               });
                                                      return null;
                                                  })

                                              });

    it('should load a known user',function(done){
        ctmldap.loadUser({params:{'uid':'jmarca'}}
                        ,null,function(err,user){
                                  should.not.exist(err);
                                  should.exist(user);
                                  user.mail.should.equal('jmarca@translab.its.uci.edu');
                                  done()
                              });
    });

    it('should create and modify a new entry',function(done){
        ctmldap.createNewUser({params:{'uid':'more trouble'
                                      ,'mail':test_email
                                      ,'givenName':'Bran'
                                      ,'sn':'McMuphin'
                                      }},null,function(err,user){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  var pass;
                                                  async.series([function(cb){
                                                                    ctmldap.resetPassword({params:{'uid':'more trouble'}}
                                                                                         ,null
                                                                                         ,function(err,barePassword){
                                                                                              should.not.exist(err)
                                                                                              should.exist(barePassword)
                                                                                              pass = barePassword
                                                                                              ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                              ,null
                                                                                                              ,function(err,user){
                                                                                                                   should.not.exist(err)
                                                                                                                   ssha.checkssha(barePassword
                                                                                                                                 ,user.userpassword
                                                                                                                                 ,function(err,result){
                                                                                                                                      should.not.exist(err);
                                                                                                                                      should.exist(result);
                                                                                                                                      result.should.equal(true);
                                                                                                                                      cb()
                                                                                                                                  })
                                                                                                               })
                                                                                          })
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.editUser({params:{'uid':'more trouble'
                                                                                             ,'mail':'farfalla@activimetrics.com'
                                                                                             ,'sn':'McBouncy'
                                                                                             }}
                                                                                    ,null
                                                                                    ,function(err){
                                                                                         should.not.exist(err)
                                                                                         ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                         ,null
                                                                                                         ,function(err,user){
                                                                                                              should.not.exist(err)
                                                                                                              user.mail.should.equal('farfalla@activimetrics.com')
                                                                                                              user.sn.should.equal('McBouncy')
                                                                                                              user.cn.should.equal('Bran McBouncy')
                                                                                                              cb()
                                                                                                          });
                                                                                     })
                                                                }
                                                               ,function(cb){
                                                                    ctmldap.editUser({params:{'uid':'more trouble'
                                                                                             ,'mail':'baka@activimetrics.com'
                                                                                             ,'sn':'McBlighty'
                                                                                             ,'userPassword':'smeagol'
                                                                                             ,'currentPassword':pass
                                                                                             }}
                                                                                    ,null
                                                                                    ,function(err){
                                                                                         should.not.exist(err)
                                                                                         ctmldap.loadUser({params:{'uid':'more trouble'}}
                                                                                                         ,null
                                                                                                         ,function(err,user){
                                                                                                              should.not.exist(err)
                                                                                                              user.mail.should.equal('baka@activimetrics.com')
                                                                                                              user.sn.should.equal('McBlighty')
                                                                                                              user.cn.should.equal('Bran McBlighty')
                                                                                                              ssha.checkssha('smeagol'
                                                                                                                            ,user.userpassword
                                                                                                                            ,function(err,result){
                                                                                                                                 should.not.exist(err);
                                                                                                                                 should.exist(result);
                                                                                                                                 result.should.equal(true);
                                                                                                                                 cb()
                                                                                                                             })
                                                                                                          });
                                                                                     })
                                                                }]
                                                               ,function(err){
                                                                    done(err);
                                                                });

                                              });
    })
    it('should fail to modify to a chosen password with incorrect current password'
      ,function(don){
           ctmldap.editUser({params:{'uid':'jmarca'
                                    ,'userpassword':'poobah'
                                    ,'currentpassword':'notit'
                                    }}
                           ,null
                           ,function(err,barePassword){
                                should.exist(err)
                                should.not.exist(barePassword)
                                don()
                            });
       });

    it('should  modify  a chosen password with correct current password'
      ,function(don){
           ctmldap.editUser({params:{'uid':'jmarca'
                                    ,'userpassword':'poobah'
                                    ,'currentpassword':'josual tree'
                                    }}
                           ,null
                           ,function(err){
                                console.log('make the change')
                                should.not.exist(err)
                                ctmldap.loadUser({params:{'uid':'jmarca'}}
                                                ,null
                                                ,function(err,user){
                                                     console.log('check the change')
                                                     should.not.exist(err)
                                                     user.userpassword.should.not.equal('poobah') // no bare passwords anymore
                                                     ssha.checkssha('poobah'
                                                                   ,user.userpassword
                                                                   ,function(err,result){
                                                                        should.not.exist(err);
                                                                        should.exist(result);
                                                                        result.should.equal(true);
                                                                        don()
                                                                    })
                                                 })
                            })
       });

});

