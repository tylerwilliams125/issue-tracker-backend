import express from 'express';
import debug from 'debug';
import Joi from 'joi';
import { validBody } from '../../middleWare/validBody.js';
import { validId } from '../../middleWare/validId.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import {nanoid} from 'nanoid';
import jwt from 'jsonwebtoken';
import{connect, getUsers,getUserById,addUser,loginUser,updateUser,deleteUser, findRoleByName, newId,saveEdit} from '../../database.js';
import { isLoggedIn, fetchRoles, mergePermissions, hasPermission } from '@merlin4/express-auth';


const debugUser = debug('app:UserRouter');
const router = express.Router();
router.use(express.urlencoded({extended:false}));
//FIXME: use this array to store user data in for now
// we will replace this with a database in a later assignment
const authSecret = process.env.AUTH_SECRET;
const authExpiresIn = process.env.AUTH_EXPIRES_IN;
const authMaxAge = parseInt(process.env.AUTH_COOKIE_MAX_AGE);
async function issueAuthToken(user){
  const payload = {_id: user._id, email: user.email, role: user.role};
  const secret = process.env.JWT_SECRET;
  const options = {expiresIn:'1h'};


  const roles = await fetchRoles(user, role => findRoleByName(role));

  // roles.forEach(role => {
  //     debugUser(`The users role is ${(role.name)} and has the following permissions: ${JSON.stringify(role.permissions)}`);
  // });

  const permissions = mergePermissions(user, roles);
  payload.permissions = permissions;

  //debugUser(`The users permissions are ${permissions}`);

  const authToken = jwt.sign(payload, secret, options);
  return authToken;
}
function issueAuthCookie(res, authToken){
  const cookieOptions = {httpOnly:true,maxAge:1000*60*60, sameSite:'none', secure:true};
  res.cookie('authToken',authToken,cookieOptions);
}


const newUserSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().required(),
  givenName: Joi.string().required(),
  familyName: Joi.string().required(),
  fullName: Joi.string().required(),
});

const loginUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateUserSchema = Joi.object({
  email: Joi.string().email(),
  password: Joi.string(),
  fullName: Joi.string(),
  givenName: Joi.string(),
  familyName: Joi.string(),
  role: Joi.string().valid(`developer`, `business analyst`, `quality analyst`, `product manager`, `technical manager`),
});




//works
router.get('/list', isLoggedIn(), async (req, res) => {
  try {
    const db = await connect();
    const collection = db.collection('User');
    const query = {};

    // Define the options for sorting and pagination
    const options = {
      limit: parseInt(req.query.pageSize) || 5,
      skip: (parseInt(req.query.pageNumber) - 1 || 0) * (parseInt(req.query.pageSize) || 5),
    };

    // Handle the "keywords" query parameter
    if (req.query.keywords) {
      query.$text = { $search: req.query.keywords };
    }

    // Handle the "classification" query parameter
    if (req.query.classification) {
      query.classification = req.query.classification;
    }

    // Handle the "maxAge" and "minAge" query parameters
    if (req.query.maxAge) {
      const maxAgeDate = new Date();
      maxAgeDate.setDate(maxAgeDate.getDate() - parseInt(req.query.maxAge));
      query.createdAt = { $gte: maxAgeDate };
    }

    if (req.query.minAge) {
      const minAgeDate = new Date();
      minAgeDate.setDate(minAgeDate.getDate() - parseInt(req.query.minAge));

      // Use $and operator to combine conditions
      query.createdAt = {
        ...query.createdAt,
        $lt: minAgeDate,
      };
    }

    // Handle the "closed" query parameter
    if (req.query.closed === 'true' || req.query.closed === 'false') {
      query.closed = req.query.closed === 'true';
    }

    // Sorting logic based on "sortBy" query parameter
    switch (req.query.sortBy) {
      case 'newest':
        options.sort = { createdAt: -1 };
        break;
      case 'oldest':
        options.sort = { createdAt: 1 };
        break;
      case 'title':
        options.sort = { title: 1, createdAt: -1 };
        break;
      case 'classification':
        options.sort = { classification: 1, createdAt: -1 };
        break;
      case 'assignedTo':
        options.sort = { assignedTo: 1, createdAt: -1 };
        break;
      case 'createdBy':
        options.sort = { createdBy: 1, createdAt: -1 };
        break;
      default:
        options.sort = { createdAt: -1 }; // Default sorting by newest
        break;
    }

    // Perform the database query using the constructed query and options
    const users = await collection.find(query, options).toArray();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});
//works
router.get('/:id', isLoggedIn(), validId('id'), async (req,res) => {
  debugUser('User Route Getting user data');
  const id = req.id;
  try{
      const user = await getUserById(id);
      if(user){
          res.status(200).json(user);
      }else{
          res.status(404).json({message: `User ${id} not found`});
      }
  } catch(err){
      res.status(500).json({error: err.stack});
  }
});
//works
router.post('/register', validBody(newUserSchema), async (req, res) => {
 // Create a new user object with additional information
 const newUser = {
  _id: newId(),
  ...req.body,
  createdOn: new Date(),
  role: ['developer'],
};

// Hash the password using bcrypt
newUser.password = await bcrypt.hash(newUser.password, 10);

try {
  // Add the user to the users collection
  const result = await addUser(newUser);

  if (result.acknowledged) {
    // Add a record to the edits collection to track the changes
    const edit = {
      timestamp: new Date(),
      col: 'user',
      op: 'insert',
      target: { userId: newUser._id },
      update: newUser,
    };

    await saveEdit(edit);

    // Ready to create the cookie and JWT Token
    const authToken = await issueAuthToken(newUser);
    issueAuthCookie(res, authToken);

    res.status(200).json({
      message: `New user ${newUser.fullName} added`,
      fullName: newUser.fullName,
      role: newUser.role,
    });
  }
} catch (err) {
  console.error('Error registering user:', err);
  res.status(500).json({ error: 'Internal server error' });
}
});
//works
router.post('/login', validBody(loginUserSchema), async (req, res) => {
  const user = req.body;

  const resultUser = await loginUser(user);
  debugUser(resultUser);

  if (resultUser && (await bcrypt.compare(user.password, resultUser.password))) {
    // User authentication successful
    const authToken = await issueAuthToken(resultUser);
    issueAuthCookie(res, authToken);

    res.status(200).json({
      message: `Welcome ${resultUser.fullName}`,
      authToken: authToken,
      email: resultUser.email,
      fullName: resultUser.fullName,
      role: resultUser.role,
    });
  } else {
    // Authentication failed
    res.status(401).json({ error: 'Email or password incorrect' });
  }
});
//to be fixed
router.put('/:id', isLoggedIn(), validId('id'), validBody(updateUserSchema), async (req, res) => {
  try {
    debugUser('Admin Route Updating a user');
    
    const updatedUser = req.body;
    const userId = req.params.id;

    // Retrieve the user by ID
    const user = await getUserById(userId);

    if (user) {
      // Update user properties based on the request body
      if (updatedUser.fullName) {
        user.fullName = updatedUser.fullName;
      }
      if (updatedUser.password) {
        user.password = await bcrypt.hash(updatedUser.password, 10);
      }

      // Ensure that other fields are updated as needed

      // Perform the update operation
      const dbResult = await updateUser(user);

      if (dbResult.modifiedCount === 1) {
        // Log the edit
        const edit = {
          timeStamp: new Date(),
          op: 'Admin Update User',
          collection: 'User',
          target: user._id,
          update: { ...updatedUser }, // Include other updated fields if needed
          auth: req.auth,
        };
        await saveEdit(edit);

        res.status(200).json({ message: `User ${userId} updated` });
      } else {
        res.status(400).json({ message: `User ${userId} not updated` });
      }
    } else {
      res.status(404).json({ message: `User ${userId} not found` });
    }
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



//to be fixed
router.get('/me', isLoggedIn(),validId('userId'), async (req, res) => {
  try {
    debugUser('User Route Getting user data');

    // Ensure that req.auth contains the user's authentication information
    const userId = req.auth._id;

    // Check if the userId is a valid ObjectId
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Query the database to get user information by userId
    const user = await getUserById(userId);

    if (user) {
      // Return user data to the client
      res.status(200).json(user);
    } else {
      // User not found in the database
      res.status(404).json({ message: `User ${userId} not found` });
    }
  } catch (err) {
    // Handle any server-side errors
    console.error('Error retrieving user data:', err);
    res.status(500).json({ error: err.stack });
  }
});
//to be fixed
router.put('/me', isLoggedIn(), validBody(updateUserSchema), validId('id'), async (req, res) => {
  debugUser(`Self Service Route Updating a user ${JSON.stringify(req.auth)}`);
  const updatedUser = req.body;

  try {
    const id = req.auth._id; // Extract user ID from authentication information
    const user = await getUserById(id);

    if (user) {
      if (updatedUser.fullName) {
        user.fullName = updatedUser.fullName;
      }
      if (updatedUser.password) {
        user.password = await bcrypt.hash(updatedUser.password, 10);
      }

      // Update additional fields
      user.lastUpdatedOn = new Date();
      user.lastUpdatedBy = req.auth;

      const dbResult = await updateUser(user);

      if (dbResult.modifiedCount === 1) {
        const edit = {
          timeStamp: new Date(),
          op: 'Self-Edit Update User',
          collection: 'User',
          target: user._id,
          update: { ...updatedUser, lastUpdatedOn: user.lastUpdatedOn, lastUpdatedBy: user.lastUpdatedBy },
          auth: req.auth,
        };
        await saveEdit(edit);

        // Issue a new token with updated information
        const authToken = await issueAuthToken(user);
        issueAuthCookie(res, authToken);

        res.status(200).json({ message: `User ${id} updated` });
      } else {
        res.status(400).json({ message: `User ${id} not updated` });
      }
    } else {
      res.status(400).json({ message: `User ${id} not found` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});


//works
router.delete('/:userId', isLoggedIn(), async (req, res) => {
// Ensure that the user is logged in before proceeding
if (!req.auth) {
  return res.status(401).json({ error: 'User not logged in' });
}

const userId = req.params.userId;

// Check if userId is a valid ObjectId using a regular expression
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
if (!objectIdRegex.test(userId)) {
  return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
}

try {
  const dbResult = await deleteUser(userId);
  if (dbResult.deletedCount === 1) {
    const edit = {
      timeStamp: new Date(),
      op: 'delete',
      collection: 'user',
      target: { userId: new ObjectId(userId) }, // Convert userId to ObjectId
      auth: req.auth,
    };
    await saveEdit(edit);

    res.status(200).json({ message: `User ${userId} deleted` });
  } else {
    res.status(400).json({ message: `User ${userId} not deleted` });
  }
} catch (err) {
  res.status(500).json({ error: err.stack });
}
});


export {router as UserRouter};


