//Importar dependencias y modulos
const User = require("../models/user");
const bcrypt = require("bcrypt");
const moongosePagination = require("mongoose-pagination");
const fs = require("fs");
const path  = require("path");

//Importar servicios
const jwt = require("../service/jwt");
const followService = require("../service/followService")
const Validate = require("../helpers/validate");


//importar modelos
const Follow = require("../models/follow");
const Publication = require("../models/publication");
const validate = require("../helpers/validate");




//Acciones de prueba
const pruebaUser = (req, res) => {
  return res.status(200).send({
    message: "Mensaje enviado desde: controllers/user.js",
    usuario: req.user
  });
}

//Registro de usuarios
const register = async (req, res) => {
  //Recoger datos de la peticion
  let params = req.body;


  //Comprobar que llegan bien los valores ( + Validacion)
  if (!params.name || !params.email || !params.password || !params.nick) {
    return res.status(400).json({
      message: "Falta datos por enviar",
      status: "error"
    });
  }

   try{
     Validate(params)
   }catch(error){
    return res.status(400).json({
      message: "Validacion no superada",
      status: "error"
    });
   }

  
  //control de usuarios duplicados
  try {
    const users = await User.find({
      $or: [
        { email: params.email.toLowerCase() },
        { nick: params.nick.toLowerCase() }
      ]
    }).exec();

    if (users && users.length >= 1) {
      return res.status(200).send({
        status: "success",
        message: "El usuario ya existe"
      });
    }

    // Cifrar la contraseña
    let pwd = await bcrypt.hash(params.password, 10)
    params.password = pwd;

    //Crear objeto de usuario
    let user_to_save = new User(params);


    // Guardar usuario en la base de dato
    try {

      const userStore = await user_to_save.save();
      if (!userStore) {
        return res.status(500).send(
          {
            status: "error",
            message: "error al guardar el usuario"
          });
      }

      return res.status(200).json({
        status: "success",
        message: "Usuario registrado correctamente",
        user: userStore
      });
    } catch (error) {
      return res.status(500).send({
        status: "error",
        message: "Error al guardar el usuario"
      });
    }

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error en la consulta de usuario"
    });
  }

}

const login = async (req, res) => {
  //Recoger parametro body
  let params = req.body;

  if (!params.email || !params.password) {
    return res.status(400).send({
      status: "error",
      message: "Faltan datos por enviar"
    });
  }

  //Buscar en la base de datos si existe
  try {
    const user = await User.findOne({ email: params.email })
      // .select({"password": 0})
      .exec();


    if (!user) {
      return res.status(404).send({
        status: "error",
        message: "No existe el usuario"
      });
    }

    // Comprobar la contraseña
    const pwd = bcrypt.compareSync(params.password, user.password);
    console.log(params.password)
    console.log(user.password)
    console.log(pwd)

    if (!pwd) {
      return res.status(400).send({
        status: "error",
        message: "No te has identificado correctamente"
      })
    }
    // conseguir el Token
    const token = jwt.createToken(user);

    // Devolver Datos del usuario
    return res.status(200).send({
      status: "success",
      message: "Te has identificado correctamente",
      user: {
        id: user._id,
        name: user.name,
        nick: user.nick
      },
      token

    });
  } catch (error) {
    return res.status(500).send({
      status: "error",
      message: "Error en la consulta de usuario"
    });
  }

}

const profile = async (req, res) => {
  //Recibir el parametro del id de usuario por la url
  const id = req.params.id;

  //Consulta para sacar los datos del usuario
  try {
    const userProfile = await User.findById(id)
      .select({ password: 0, role: 0 })

    if (!userProfile) {
      return res.status(404).send({
        status: "error",
        message: "El usuario no existe"
      });
    }

    //Info de seguimiento
    const followInfo = await followService.followThisUser(req.user.id, id);
    //Devolver el resultado


    return res.status(200).send({
      status: "success",
      user: userProfile,
      following: followInfo.following,
      follower: followInfo.followers
    })

  } catch (error) {
    return res.status(400).send({
      status: "error",
      message: "Error al obtener el id"
    })
  }

}

const list = async (req, res) => {

  // Controlar en que pagina estamos

  let page = 1;
  if (req.params.page) {
    page = req.params.page;
  }
  page = parseInt(page)

  const itemsPerPage = 5;


  try {
    const result = await User.find()
       .select("-password -email -__v -role")
      .sort("_id")
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    if (!result || result.length === 0) {
      return res.status(404).send({
        status: "error",
        message: "No hay usuarios",
      });
    }
  
    //Sacar un array de ids de los usuarios que me siguen y los que sigo como victor
    let followUserIds = await followService.followUserIds(req.user.id)
    const total = await User.countDocuments();

    return res.status(200).send({
      status: "success",
      users: result,
      page,
      itemsPerPage,
      total,
      pages: Math.ceil(total / itemsPerPage),
      user_following: followUserIds.following,
      user_follow_me: followUserIds.followers
    });
  } catch (error) {
    return res.status(500).send({
      status: "error",
      message: "Error en el servidor",
      error,
    });
  }

}

const update = (req, res) => {
  // recoger Info del usuario a actualizar
  let userIdentity = req.user;
  let userToUpdate = req.body;

  //eliminar campos sobrantes
  delete userToUpdate.iat;
  delete userToUpdate.exp;
  delete userToUpdate.role;
  delete userToUpdate.image;

  //Comprobar si el usuario ya existe
  User.find({
    $or: [
      { email: userToUpdate.email.toLowerCase() },
      { nick: userToUpdate.nick.toLowerCase() },
    ]
  })
    .then(users => {
      let userIsset = false;
      users.forEach(user => {
        if (user && user._id != userIdentity.id) userIsset = true;
      });

      if (userIsset) {
        return res.status(200).send({
          status: "success",
          message: "El usuario ya existe",
        });
      }

      // Cifrar la contraseña
      if (userToUpdate.password) {
        return bcrypt.hash(userToUpdate.password, 10);
      } else {
        return Promise.resolve(null); // No hay contraseña para cifrar
      }
    })
    .then(pwd => {
      if (pwd !== null) {
        userToUpdate.password = pwd;
      }

      // Buscar y actualizar
      return User.findByIdAndUpdate(userIdentity.id, userToUpdate, { new: true });
    })
    .then(updatedUser => {
      if (!updatedUser) {
        return res.status(500).json({
          status: "error",
          message: "Error en al actualizar usuario",
        });
      }

      return res.status(200).send({
        status: "success",
        message: "Método de actualizar",
        user: updatedUser,
      });
    })
    .catch(error => {
      return res.status(500).json({
        status: "error",
        message: "Error en la consulta del usuario",
        error,
      });
    });
}

const upload = async (req, res) => {

  //Recoger el fichero de imagen y comprobar que existe
  if (!req.file) {
    return res.status(404).send({
      status: "error",
      message: "peticion no incluye la imagen"
    })
  }

  //conseguir el nombre del archivo
  let image = req.file.originalname;

  //Sacar la extension del archivo
  const imageSplit = image.split("\.");
  const extension = imageSplit[1];


  //Comprobar extension
  if (extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif") {


    //Borrar archivo subido
    const filePath = req.file.path;
    const fileDeleted = fs.unlinkSync(filePath);

    //Devolver respuesta negativa
    return res.status(400).send({
      status: "error",
      message: "Extension del fichero invalida"
    })

  }

  //Si es correcto guardar imagen en la base de datos
  let userUpdate = await User.findOneAndUpdate({ _id: req.user.id }, { image: req.file.filename }, { new: true });

  try {
    if (!userUpdate) {
      return res.status(500).send({
        status: "error",
        message: "error en la subida del avatar",
        user: req.user,
        error: error.message
      });
    }

    //Devolver respuesta
    return res.status(200).send({
      status: "success",
      user: userUpdate,
      file: req.file,
    });

  } catch (error) {
    return res.status(400).send({
      status: "error",
      message: "error en la app",
      user: req.user,
      error: error.message
    });
  }

}

const avatar = (req, res) => {
  //Sacar el parametro de la url
  const file = req.params.file;
  //montar el path real de la imagen
  const filePath = "./uploads/avatars/" + file;

  //comprobar que existe
  fs.stat(filePath, (error, exists) => {
    if (!exists){ 
     return res.status(404).send({ 
      status: "error",
       message: "No existe la imagen"
       });
     }

    //devolver un file
    return res.sendFile(path.resolve(filePath));

  });
}


const counter = async (req, res) => {

  let userId = req.user.id;

  if(req.params.id){
    userId = req.params.id;
  }

  try{
    const following = await Follow.count({"user": userId});

    const followed = await Follow.count({"followed": userId});
    
    const publications = await Publication.count({"user": userId});

    return res.status(200).send({
      userId,
      following: following,
      followed: followed,
      publications: publications
    })

  }catch(error){
    return res.status(404).send({
      status: "error",
      message: "Error en los contadores",
      error
    })
  }
}

//exportar acciones
module.exports = {
  pruebaUser,
  register,
  login,
  profile,
  list,
  update,
  upload,
  avatar,
  counter
}