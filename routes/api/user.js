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

const commentSchema = Joi.object({
  fullName: Joi.string().required(),
 comment: Joi.string().required(),
});



router.get('/list', async (req, res) =>{
  debugBug('Getting Bugs with Additional Search Functionality');

  try {
    const db = await connect();
    const collection = db.collection('Bug');
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
      query.createdAt = { ...query.createdAt, $lt: minAgeDate };
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
    const bugs = await collection.find(query, options).toArray();
    res.status(200).json(bugs);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get("/:userId",validId, async (req,res) =>{
  const userId = req.params.userId;

  if (!isValidObjectId(userId)) {
    return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
  }

  try {
    const user = await getUserById(userId);

    if (user) {
      // Check if the request includes valid user authentication, e.g., username and password
      const { username, password } = req.body; // Assuming you're using a POST request with user credentials
      
      if (username && password) {
        // Validate the user's credentials
        if (await bcrypt.compare(password, user.password)) {
          // Authentication is successful

          // Issue a new JWT token
          const authPayload = {
            userId: user._id, // Save user data that you will want later
          };
          const authSecret = config.get('auth.secret');
          const authExpiresIn = config.get('auth.tokenExpiresIn');
          const authToken = jwt.sign(authPayload, authSecret, { expiresIn: authExpiresIn });

          // Save the JWT token in a cookie
          const authMaxAge = parseInt(config.get('auth.cookieMaxAge'));
          res.cookie('authToken', authToken, { maxAge: authMaxAge, httpOnly: true });

          res.status(200).json({ message: 'Welcome Back!', userId: user._id, authToken });
        } else {
          // Authentication failed
          res.status(401).json({ error: 'Authentication failed' });
        }
      } else {
        // No user credentials provided in the request, so just return the user's information
        res.status(200).json(user);
      }
    } else {
      res.status(404).json({ error: `User with userId ${userId} not found.` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.post('/register',validBody(newUserSchema), async (req,res) => {
    //FIXME: Register new user and send response as JSON
    try {
      // Validate the request data against the schema
      const { error } = newUserSchema.validate(req.body);
  
      if (error) {
        return res.status(400).json({ error: error.details });
      }
  
      // If validation passes, proceed to register the new user
      const { email, password, fullName, givenName, familyName } = req.body;
  
      // Hash the password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Generate a new user ID and set the created date
      const userId = new ObjectId();
      const createdAt = new Date();
  
      // Define the initial user role as 'developer'
      const role = ['developer'];
  
      // Create the user document
      const newUser = {
        _id: userId,
        email,
        password: hashedPassword, // Store the hashed password
        fullName,
        givenName,
        familyName,
        createdAt,
        role,
      };
  
      // Add the user to the user collection (You'll need to implement the 'addUser' function)
      await addUser(newUser);
  
      // Record the registration in the 'edits' collection
      const editRecord = {
        timestamp: new Date(),
        col: 'user',
        op: 'insert',
        target: { userId },
        update: newUser,
      };
  
      // Add the edit record to the 'edits' collection (You'll need to implement the function for this)
      await addEditRecord(editRecord);
  
      // Issue a JWT token for the newly registered user
      const authPayload = {
        userId, // Save user data that you will want later
      };
      const authSecret = config.get('auth.secret');
      const authExpiresIn = config.get('auth.tokenExpiresIn');
      const authToken = jwt.sign(authPayload, authSecret, { expiresIn: authExpiresIn });
  
      // Save the JWT token in a cookie
      const authMaxAge = parseInt(config.get('auth.cookieMaxAge'));
      res.cookie('authToken', authToken, { maxAge: authMaxAge, httpOnly: true });
  
      res.status(200).json({ message: 'User Registered!', userId, authToken });
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

    if (resultUser) {
      // Check if the provided password matches the stored password (make sure to hash it with bcrypt)
      const passwordMatch = await bcrypt.compare(user.password, resultUser.password);

      if (passwordMatch) {
        // Generate a JSON Web Token (JWT)
        const authPayload = {
          userId: resultUser.userId, // Replace with the actual user identifier
        };
        const authSecret = config.get('auth.secret');
        const authExpiresIn = config.get('auth.tokenExpiresIn');
        const authToken = jwt.sign(authPayload, authSecret, { expiresIn: authExpiresIn });

        // Store the JWT token in a cookie
        const authMaxAge = parseInt(config.get('auth.cookieMaxAge'));
        res.cookie('authToken', authToken, { maxAge: authMaxAge, httpOnly: true });

        res.status(200).json({ message: `Welcome ${resultUser.fullName}` });
      } else {
        res.status(401).json({ error: 'Email or password incorrect' });
      }
    } else {
      res.status(401).json({ error: 'Email or password incorrect' });
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