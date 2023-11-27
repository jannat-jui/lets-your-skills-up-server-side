const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
  ],
  credentials: true
}));
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vgt34f5.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const teacherRequestCollection = client.db("letsSkillDb").collection("teacherrequest")
    const usersCollection = client.db("letsSkillDb").collection("users")
    const classesCollection = client.db("letsSkillDb").collection("classes")
    const paymentCollection = client.db("letsSkillDb").collection("payments")
    const assignmentCollection = client.db("letsSkillDb").collection("assignments")
    const feedBackCollection = client.db("letsSkillDb").collection("feedbacks")

    // jwt related apis

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })

    // middle wares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // teacher request apis

    app.post('/teacherrequest', async (req, res) => {
      const item = req.body;
      const result = await teacherRequestCollection.insertOne(item);
      res.send(result)
    })

    app.get('/teacherrequest', async (req, res) => {
      const result = await teacherRequestCollection.find().toArray()
      res.send(result)
    })



    app.get('/teacherrequest/teacher/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await teacherRequestCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'teacher';
      }
      res.send({ admin });
    })

    app.put('/teacherrequest/teacher/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedclass = req.body;

      const product = {
        $set: {
          role: updatedclass.role,

        }
      }

      const result = await teacherRequestCollection.updateOne(filter, product, options);
      res.send(result)

    })

    // app.patch('/teacherrequest/teacher/:id', async(req, res)=>{
    //   const id= req.params.id;
    //   const filter = {_id: new ObjectId(id)}
    //   const updatedDoc = {
    //     $set: {
    //       role: 'teacher'
    //     }
    //   }
    //   const result = await teacherRequestCollection.updateOne(filter, updatedDoc);
    //   res.send(result)

    // })



    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers)
      const filter = req.query;
      const query = {
        name: { $regex: filter.search || '', $options: 'i' },

      }
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })


    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)

    })

    // teacher dashboard informations

    app.post('/addclasses', async (req, res) => {
      const item = req.body;
      const result = await classesCollection.insertOne(item);
      res.send(result)
    })


    app.get('/addclasses', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await classesCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/addclasses/adminroute', verifyToken, verifyAdmin, async (req, res) => {
      console.log(req.headers)
      const result = await classesCollection.find().toArray()
      res.send(result)
    })

    app.get('/addclasses/adminroute/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }

      const query = { email: email };
      const user = await classesCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    app.patch('/addclasses/:id', verifyToken, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          email: item.email,
          title: item.title,
          price: item.price,
          description: item.description,
          image: item.image
        }
      }

      const result = await classesCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    app.delete('/addclasses/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.deleteOne(query)
      res.send(result);
    })


    app.put('/addclasses/adminroute/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedclass = req.body;

      const product = {
        $set: {
          status: updatedclass.status,

        }
      }

      const result = await classesCollection.updateOne(filter, product, options);
      res.send(result)

    })

    app.get('/addclasses/adminroute/approved', async (req, res) => {

      const result = await classesCollection.find({ status: 'approved' }).toArray()
      res.send(result)
    })

    app.get('/addclasses/adminroute/approved/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classesCollection.findOne(query);
      res.send(result);
    })

    // class assignments
    app.post('/assignments', async (req, res) => {
      const item = req.body;
      const result = await assignmentCollection.insertOne(item);
      res.send(result)
    })

    app.get('/assignments', async (req, res) => {
      const result = await assignmentCollection.find().toArray()
      res.send(result)
    })


    //payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    // payment related apis
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send(paymentResult);
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    //feedbacks
    app.post('/feedbacks', async (req, res) => {
      const payment = req.body;
      const paymentResult = await feedBackCollection.insertOne(payment);
      res.send(paymentResult);
    })

    app.get('/feedbacks', async (req, res) => {

      const result = await feedBackCollection.find().toArray()
      res.send(result)
    })


    // tatal enroll ment count
    

    app.patch('/addclasses/adminroute/approved/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { enrollCount: 1 } }
      );
      res.send(result);
    })










    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('LetsSkillUp is running')
})
app.listen(port, () => {
  console.log(`LetsSkillUp is sitting on port ${port}`);
})
