import express from 'express';
import debug from 'debug';
import {nanoid} from 'nanoid';
import{connect, getUsers,getUserById,addUser,loginUser,updateUser,deleteUser} from '../../database.js';


const debugUser = debug('app:UserRouter');
const router = express.Router();
router.use(express.urlencoded({extended:false}));
//FIXME: use this array to store user data in for now
// we will replace this with a database in a later assignment


router.get('/list', async (req, res) =>{
  debugUser('Getting all Users')
  try{
    const db = await connect();
    const users = await getUsers();
    res.status(200).json(users)
  }catch(err){
    res.status(500).json({error: err.stack});
  }
});

router.get("/:userId", async (req,res) =>{
    //Reads the userID from the URL and stores in a variable
    //FIXME: Get the user from usersArray and send response as JSON
    const userId = req.params.userId;
  try{
    const user = await getUserById(userId);
    res.status(200).json(user);
  }catch(err){
    res.status(500).json({error: err.stack});
  }
});

router.post('/register', async (req,res) => {
    //FIXME: Register new user and send response as JSON
    const { email, password, fullName, givenName, familyName, role } = req.body;
    const userId = req.params.userId;

    try {
      
  
      if (!email || !password || !fullName || !givenName || !familyName || !role) {
        res.status(400).json({ error: 'Missing required data.' });
        return;
      }
  
     
  
      const newUser = {email,password,fullName,givenName,familyName, role,createdAt: new Date()};
      const result = await addUser(newUser);

      res.status(200).json({ message: `User ${fullName} registered!`});
    } catch (err) {
      console.error('Database error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }

});


router.post('/login',async (req,res) =>{
  //FIXME: check user's email and password and send response as JSON
  const user = req.body;

  const resultUser = await loginUser(user);
  debugUser(resultUser);
  if(resultUser && await(user.password, resultUser.password)){
    res.status(200).json(`Welcome ${resultUser.fullName}`);
  }else{
    res.status(401).json(`email or password incorrect`);
  }

});

router.put('/:userId', async (req,res) => {
  //FIXME: update existing user and send response as JSON
  const userId = req.params.userId;
  const updatedUser = req.body;
 
  try{
    const updateResult = await updateUser(userId,updatedUser);
      if(updateResult.modifiedCount == 1){
      res.status(200).json({message: `User ${userId} updated`})
      }else{
        res.status(400).json({message: `User ${userId} not updated`})
      }
    }catch(err){
      res.status(500).json({error: err.stack});
    }
});

router.delete('/:userId', async (req,res) =>{
    //FIXME: delete user and send response as JSON
     //gets the id from the url
  //gets the id from the url
  const userId = req.params.userId;

  try{
    const dbResult = await deleteUser(userId);
    if(dbResult.deletedCount == 1){
      res.status(200).json({message: `User ${userId} deleted`})
      }else{
        res.status(400).json({message: `User ${userId} not deleted`})
      }
  }catch(err){
    res.status(500).json({error: err.stack});
  }
});

export {router as UserRouter};