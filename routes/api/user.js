import express from 'express';
import debug from 'debug';
import {nanoid} from 'nanoid';


const debugUser = debug('app:UserRouter');
const router = express.Router();
router.use(express.urlencoded({extended:false}));
//FIXME: use this array to store user data in for now
// we will replace this with a database in a later assignment
const usersArray = [
  {"email":"TylerKWilliams125@gmail.com","password":"kamenrider","fullName":"Tyler Williams","givenName":"Tyler","familyName":"Williams","role":"Admin", "_id":1},
  {"email":"Eagudmestad@gmail.com","password":"luv2run","fullName":"Evan Gudmestad","givenName":"Evan","familyName":"Gudmestad","role":"Teacher","_id":2},
  {"email":"Imissmywife@gmail.com","password":"didntkillherlol","fullName":"James Sunderland","givenName":"James","familyName":"Sunderland","role":"Wife Hunter","_id":3},
  {"email":"Boulderpunch@gmail.com","password":"needmypeanutbuster","fullName":"Chris Redfield","givenName":"Chris","familyName":"Redfield","role":"Boulder Puncher","_id":4},
  {"email":"Ihatechris@gmail.com","password":"missmybabytyrant","fullName":"Albert Wesker","givenName":"Albert","familyName":"Wesker","role":"Sunglasses Enthusiast","_id":5},
  {"email":"Jillsandwich@gmail.com","password":"iwantasandwich","fullName":"Jill Valentine","givenName":"Jill","familyName":"Valentine","role":"","_id":6},
  {"email":"Bestreprotag@gmail.com","password":"goingtobingo","fullName":"Leon Kennedy","givenName":"Leon","familyName":"Kennedy","role":"","_id":7},
  {"email":"Luvmesomeleon@gmail.com","password":"reallyluvleon","fullName":"Ada Wong","givenName":"Ada","familyName":"Wong","role":"","_id":8}
];

router.get('/list', (req, res) =>{
  debugUser('Getting all users')
  res.status(200).json(usersArray);
});

router.get("/:userId", (req,res) =>{
    //Reads the userID from the URL and stores in a variable
    //FIXME: Get the user from usersArray and send response as JSON
    const userId = req.params.userId;
    const user = usersArray.find(user => user._id == userId)
  if(user){
    res.status(200).json(user);
  }else{
      res.status(404).send({message: `User ${userId} not found`});
  }
});

router.post('/register', (req,res) => {
    //FIXME: Register new user and send response as JSON
    const { email, password, fullName, givenName, familyName, role } = req.body;
    const newUser = {email, password, fullName, givenName, familyName, role } ;
    const existingUser = usersArray.find((user) => user.email === email);
    if (existingUser) {
      return res.status(400).type('text/plain').send('Email already registered.');
    };
    if(email, password, fullName, givenName, familyName, role)
    {
      const id = nanoid();
      newUser._id = id;
      usersArray.push(newUser);
      res.status(200).type('text/plain').send(`${newUser.fullName} registered!`);
    }

  if (!email || !password || !fullName || !givenName || !familyName || !role)
  {
    return res.status(400).type('text/plain').send('Invalid data provided.');
  };


});


router.post('/login', (req,res) =>{
  //FIXME: check user's email and password and send response as JSON
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).type('text/plain').send('Please enter your login credentials.');
  }

  const user = usersArray.find((user) => user.email === email && user.password === password);

  if (user) {
    return res.status(200).type('text/plain').send(`Welcome back ${user.fullName}!`);
  } else {
    return res.status(404).type('text/plain').send('Invalid login credential provided. Please try again.');
  }
});

router.put('/:userId', (req,res) => {
  //FIXME: update existing user and send response as JSON
  const userId = req.params.userId;
  const currentUser = usersArray.find(user => user._id == userId);

  //for this line to work, you have to have a body parser
  const updatedUser = req.body;

  if(currentUser){
      for(const key in updatedUser){
          if(currentUser[key] != updatedUser[key]){
            currentUser[key] = updatedUser[key];
          }
      }

      //save the currentUser into the array
      const index = usersArray.findIndex(user => user._id == userId);
      if(index != -1){
        usersArray[index] = currentUser;
      }

     res.status(200).type('text/plain').send(`User ${userId} updated`);
  }else{
      res.status(404).type('text/plain').send(`User ${userId} not found`);
  }
  res.json(updatedUser);
});

router.delete('/:userId', (req,res) =>{
    //FIXME: delete user and send response as JSON
     //gets the id from the url
  const userId = req.params.userId;
  //find the index of the user in the array
  const index = usersArray.findIndex(user => user._id == userId);
  if(index != -1){
      usersArray.splice(index,1);
      res.status(200).type('text/plain').send(`User ${userId} deleted`);

  } else{
    res.status(404).type('text/plain').send(`User ${userId} not found`);
  }
});


export {router as UserRouter};