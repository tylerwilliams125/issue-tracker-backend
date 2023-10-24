import express from 'express';
import debug from 'debug';
import Joi from 'joi';
import { validBody } from '../../middleWare/validBody.js';
import { validId } from '../../middleWare/validId.js';

import {nanoid} from 'nanoid';
import{connect, getUsers,getUserById,addUser,loginUser,updateUser,deleteUser} from '../../database.js';


const debugUser = debug('app:UserRouter');
const router = express.Router();
router.use(express.urlencoded({extended:false}));
//FIXME: use this array to store user data in for now
// we will replace this with a database in a later assignment

const newUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  givenName: Joi.string().required(),
  familyName: Joi.string().required(),
  role: Joi.string().valid('role1', 'role2', 'role3').required(),
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateUserSchema = Joi.object({
  password: Joi.string(),
  fullName: Joi.string(),
  givenName: Joi.string(),
  familyName: Joi.string(),
  role: Joi.string().valid('role1', 'role2', 'role3')
});




router.get('/list', async (req, res) =>{
  debugUser('Getting all Users');
  try {
    const db = await connect();
    const collection = db.collection('User'); 

    
    const query = {};

   
    const keywords = req.query.keywords;
    if (keywords) {
     
      query.$text = { $search: keywords };
    }

    
    const role = req.query.role;
    if (role) {
      query.role = role;
    }

    
    const maxAge = parseInt(req.query.maxAge);
    const minAge = parseInt(req.query.minAge);
    if (maxAge) {
      query.createdDate = { $gte: new Date(new Date() - maxAge * 24 * 60 * 60 * 1000) };
    }
    if (minAge) {
      query.createdDate = { $lt: new Date(new Date() - minAge * 24 * 60 * 60 * 1000) };
    }

    
    const sortBy = req.query.sortBy || 'givenName'; 
    let sortQuery = {};
    switch (sortBy) {
      case 'givenName':
        sortQuery = { givenName: 1, familyName: 1, createdDate: 1 };
        break;
      case 'familyName':
        sortQuery = { familyName: 1, givenName: 1, createdDate: 1 };
        break;
      case 'role':
        sortQuery = { role: 1, givenName: 1, familyName: 1, createdDate: 1 };
        break;
      case 'newest':
        sortQuery = { createdDate: -1 };
        break;
      case 'oldest':
        sortQuery = { createdDate: 1 };
        break;
    }

    // Handle 'pageSize' and 'pageNumber' query parameters
    const pageSize = parseInt(req.query.pageSize) || 5;
    const pageNumber = parseInt(req.query.pageNumber) || 1;
    const skip = (pageNumber - 1) * pageSize;

    const users = await collection
      .find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get("/:userId",validId, async (req,res) =>{
   // Reads the userID from the URL and stores it in a variable
   const userId = req.params.userId;

   // Check if userId is a valid ObjectId
   if (!isValidObjectId(userId)) {
       return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
   }

   try {
       const user = await getUserById(userId);
       res.status(200).json(user);
   } catch (err) {
       res.status(500).json({ error: err.stack });
   }
});

router.post('/register',validBody(newUserSchema), async (req,res) => {
    //FIXME: Register new user and send response as JSON
    const userId = req.params.userId;

    try {
        // Validate the request data against the schema
        const { error } = newUserSchema.validate(req.body);

        if (error) {
            return res.status(400).json({ error: error.details });
        }

        // If validation passes, proceed to register the new user
        const { email, password, fullName, givenName, familyName, role } = req.body;

        const newUser = { email, password, fullName, givenName, familyName, role, createdAt: new Date() };
        const result = await addUser(newUser);

        res.status(200).json({ message: `User ${fullName} registered!` });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }

});


router.post('/login',validBody(loginUserSchema), async (req,res) =>{
  //FIXME: check user's email and password and send response as JSON
  const user = req.body;

    // Validate the request data against the schema
    const { error } = loginUserSchema.validate(user);

    if (error) {
        return res.status(400).json({ error: error.details });
    }

    try {
        const resultUser = await loginUser(user);
        debugUser(resultUser);

        if (resultUser && user.password === resultUser.password) {
            res.status(200).json(`Welcome ${resultUser.fullName}`);
        } else {
            res.status(401).json(`email or password incorrect`);
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }


});

router.put('/:userId',validBody(updateUserSchema), async (req,res) => {
  //FIXME: update existing user and send response as JSON
  const userId = req.params.userId;

    // Check if userId is a valid ObjectId
    if (!isValidObjectId(userId)) {
        return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
    }

    try {
        // Validate the request data against the schema
        const { error } = userUpdateSchema.validate(req.body);

        if (error) {
            return res.status(400).json({ error: error.details });
        }

        // Construct the update object with only the fields provided in the request
        const updatedUser = { ...req.body };

        const updateResult = await updateUser(userId, updatedUser);

        if (updateResult.modifiedCount === 1) {
            res.status(200).json({ message: `User ${userId} updated` });
        } else {
            res.status(400).json({ message: `User ${userId} not updated` });
        }
    } catch (err) {
        res.status(500).json({ error: err.stack });
    }
});

router.delete('/:userId', async (req,res) =>{
    //FIXME: delete user and send response as JSON
     //gets the id from the url
  //gets the id from the url
  const userId = req.params.userId;

  // Check if userId is a valid ObjectId
  if (!isValidObjectId(userId)) {
      return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
  }

  try {
      const dbResult = await deleteUser(userId);
      if (dbResult.deletedCount === 1) {
          res.status(200).json({ message: `User ${userId} deleted` });
      } else {
          res.status(400).json({ message: `User ${userId} not deleted` });
      }
  } catch (err) {
      res.status(500).json({ error: err.stack });
  }
});

export {router as UserRouter};