var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')

var express = require('express');

var request = require('supertest');

describe('ldapjs_editor',function(){
    it('should not create a duplicate entry',function(done){
        ctmldap.createNewUser({params:{'uid':'jmarca'}},null,function(err,user){
            should.exist(err);
            should.not.exist(user);
            done()
        });
    });
    it('should create a  new entry',function(done){
        ctmldap.createNewUser({params:{'uid':'trouble'
                                      ,'mail':'james@activimetrics.com'
                                      ,'givenName':'Studly'
                                      ,'sn':'McHung'
                                      }},null,function(err,user){
                                                  should.not.exist(err);
                                                  should.exist(user);
                                                  done()
                                              });
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

});
