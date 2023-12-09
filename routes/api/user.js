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





router.get('/list',isLoggedIn(), async (req, res) =>{
  

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
    const users = await collection.find(query, options).toArray();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

router.get("/:userId", validId('userId'),hasPermission('canViewData'), async (req, res) => {
  const userId = req.params.userId;

  if (!isValidObjectId(userId)) {
    return res.status(404).json({ error: `userId ${userId} is not a valid ObjectId.` });
  }

  try {
    const user = await getUserById(userId);

    if (user) {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      // Validate the user's credentials
      if (await bcrypt.compare(password, user.password)) {
        const authPayload = {
          userId: user._id,
        };
        const authSecret = config.get('auth.secret');
        const authExpiresIn = config.get('auth.tokenExpiresIn');
        const authToken = jwt.sign(authPayload, authSecret, { expiresIn: authExpiresIn });

        const authMaxAge = parseInt(config.get('auth.cookieMaxAge'));
        res.cookie('authToken', authToken, { maxAge: authMaxAge, httpOnly: true });

        res.status(200).json({ message: 'Welcome Back!', userId: user._id, authToken });
      } else {
        res.status(401).json({ error: 'Authentication failed' });
      }
    } else {
      res.status(404).json({ error: `User with userId ${userId} not found.` });
    }
  } catch (err) {
    res.status(500).json({ error: err.stack });
  }
});

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

router.put('/:userId', validBody(updateUserSchema), validId('id'), async (req, res) => {
  try {
    debugUser('Admin Route Updating a user');
    const updatedUser = req.body;
    const user = await getUserById(req.id);

    if (!user) {
      return res.status(404).json({ message: `User ${req.id} not found` });
    }

    if (updatedUser.fullName) {
      user.fullName = updatedUser.fullName;
    }

    if (updatedUser.password) {
      user.password = await bcrypt.hash(updatedUser.password, 10);
    }

    // Ensure email is not updated unintentionally
    if ('email' in updatedUser) {
      return res.status(400).json({ message: 'Updating email is not allowed' });
    }

    const dbResult = await updateUser(user);

    if (dbResult.modifiedCount === 1) {
      const edit = {
        timeStamp: new Date(),
        op: 'Admin Update User',
        collection: 'User',
        target: user._id,
        auth: req.auth,
      };
      await saveEdit(edit);
      res.status(200).json({ message: `User ${req.id} updated` });
    } else {
      res.status(400).json({ message: `User ${req.id} not updated` });
    }
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



router.get('/me', isLoggedIn(),validId('userId'), async (req, res) => {
  try {
    // Ensure that req.auth contains the user's authentication information
    const userId = req.auth._id;

    // Query the database to get user information by userId
    const user = await getUserById(userId);

    if (user) {
      // Return user data to the client
      res.status(200).json({
        userId: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        // Add other fields as needed
      });
    } else {
      // User not found in the database
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    // Handle any server-side errors
    console.error('Error retrieving user data:', err);
    res.status(500).json({ error: 'Internal server error' });
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


