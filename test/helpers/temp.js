var should = require('should')
var ctmldap = require('../lib/ldapjs_editor')

var express = require('express');

var request = require('supertest');

ctmldap.createNewUser({params:{'uid':'jmarca'}},null,function(err,user){
                should.not.exist(user);
                should.exist(err);
        });

