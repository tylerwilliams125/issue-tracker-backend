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

router.get("/:userId", validId('userId'), async (req, res) => {
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
  const newUser = 
    {
        _id: newId(),
        ...req.body,
        createdDate: new Date(),
    }
    
    newUser.password = await bcrypt.hash(newUser.password, 10);
    try{
        const result = await addUser(newUser);
       if(result.acknowledged==true){
            //Ready to create the cookie and JWT Token
            const authToken = await issueAuthToken(newUser);
            issueAuthCookie(res, authToken);

            res.status(200).json({
                message: `New user ${newUser.fullName} added`,
                fullName: newUser.fullName,
                role: newUser.role,
            });
       }
    }catch(err){
        res.status(500).json({error: err.stack});
    }
});

router.post('/login', validBody(loginUserSchema), async (req, res) => {
  const user = req.body;

  const resultUser = await loginUser(user);
  debugUser(resultUser);
  if(resultUser && await bcrypt.compare(user.password, resultUser.password)){
      const authToken = await issueAuthToken(resultUser);
      issueAuthCookie(res, authToken);
      res.status(200).json({
          message:`Welcome ${resultUser.fullName}`,
          authToken:authToken,
          email:resultUser.email,
          fullName:resultUser.fullName,
          role:resultUser.role,
      } );
  }else{
      res.status(401).json(`email or password incorrect`);
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


// const newUser = {
//   _id: userId,
//   email,
//   password: hashedPassword,
//   fullName,
//   givenName,
//   familyName,
//   createdAt,
//   role,
// };