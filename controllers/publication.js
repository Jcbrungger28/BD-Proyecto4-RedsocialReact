//Importar modulos
const fs = require("fs");
const path = require("path");

//importatr servicios
const followService = require("../service/followService");

//Importar modelos
const Publication = require("../models/publication");



//Acciones de prueba
const pruebaPublication = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/publication.js"
    });
}


//Guardar publicacion
const save = async (req, res) => {
    //Recoger datos del body
    const params = req.body;

    //si no me llegan dar respuesta negativa
    if (!params.text) return res.status(400).send({
        status: "error",
        message: "Debes enviar el texto de la publicacion"
    })

    //Crear y rellenar el objeto de modelo
    let newPublication = new Publication(params);
    newPublication.user = req.user.id;

    //Guardar el objeto en base de datos
    let publicationStored = await newPublication.save();
    try {
        return res.status(200).send({
            status: "success",
            message: "publicacion guardada",
            publicationStored
        })
    } catch (error) {
        if (!publicationStored) {
            return res.status(400).send({
                status: "error",
                message: "error al guardar la publicacion"
            })
        }
    }

}

//Sacar una publicacion
const detail = async (req, res) => {

    //Sacar id de la publicacion de la url
    const publicationId = req.params.id;

    //find con la condicion del id
    const publicationStored = await Publication.findById(publicationId);
    try {
        return res.status(200).send({
            status: "success",
            message: "Mostrar Publicacion",
            publication: publicationStored
        })
    } catch (error) {
        return res.status(404).send({
            status: "error",
            message: "error para obtener los detalles de esta publicacion"
        })
    }

}

//Eliminar publicaciones
const remove = async (req, res) => {
    //Sacar el id de la publicacion a eliminar
    const publicationId = req.params.id;

    //find y luego el remove
    const publicationRemove = await Publication.findOneAndRemove({ "user": req.user.id, "_id": publicationId })

    try {
        return res.status(200).send({
            status: "success",
            message: "Publicacion eliminada con exito",
            publication: publicationRemove
        })
    } catch (error) {
        return res.status(400).send({
            status: "error",
            message: "error al eliminar publicacion"
        })
    }
}

//Listar publicaciones de un usuario
const user = async (req, res) => {
    //Sacar el id del usuario
    const userId = req.params.id;

    //Controlar la pagina
    let page = 1;


    if (req.params.page) {
        page = req.params.page;
    }
    const itemsPerPage = 5;

    //find, populate, ordenar, paginar
    const PublicationList = await Publication.find({ "user": userId })
        .sort("-created_at")
        .populate("user", "-password -__v -role -email")
        .paginate(page, itemsPerPage)
    const total = await Publication.countDocuments();

    try {
        return res.status(200).send({
            status: "success",
            message: "Listado de publicacion de este usuario con exito",
            page,
            total,
            pages: Math.ceil(total / itemsPerPage),
            PublicationList,
        })
    } catch (error) {
        if (!PublicationList || PublicationList.length <= 0) {
            return res.status(400).send({
                status: "error",
                message: "No hay publicaciones para este usuario"
            });
        }
    }
}


//Subir ficheros
const upload = async (req, res) => {
    //Sacar publication id
    const publicationId = req.params.id;

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
    let publicationUpdate = await Publication.findOneAndUpdate({ "user": req.user.id, "_id": publicationId }, { file: req.file.filename }, { new: true });

    try {
        if (!publicationUpdate) {
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
            publication: publicationUpdate,
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


//Devolver archivos multimedia
const media = (req, res) => {
    //Sacar el parametro de la url
    const file = req.params.file;
    //montar el path real de la imagen
    const filePath = "./uploads/publications/" + file;

    //comprobar que existe
    fs.stat(filePath, (error, exists) => {
        if (!exists) {
            return res.status(404).send({
                status: "error",
                message: "No existe la imagen"
            });
        }

        //devolver un file
        return res.sendFile(path.resolve(filePath));

    });


}

//Listar todas las publicacion ( FEED )
const feed = async (req, res) => {
    //sacar la pagina actual 
    let page = 1;

    if (req.params.page) {
        page = req.params.page;
    }

    //Establecer numero de elementos por pagina
    let itemsPerPage = 5;

    //sacar un array de identificadores de usuarios que  yo sigo como usuario loguado
    try {
        const myFollows = await followService.followUserIds(req.user.id);

        
     //Find a publicaciones in, ordenar, popular y paginar
     const publications = await Publication.find({
        user:  myFollows.following
     }).populate("user", "-password -role -__v -email")
     .sort("-created_at")
     .paginate(page, itemsPerPage);

     const total = await  Publication.countDocuments();

        return res.status(200).send({
            status: "success",
            message: "feed de publicaciones",
            following: myFollows.following,
            publications,
            total,
            page,
            itemsPerPage,
            pages: Math.ceil(total / itemsPerPage)
        })
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "No se han listado las publicaciones del feed"
        })
    }

}

//exportar acciones
module.exports = {
    pruebaPublication,
    save,
    detail,
    remove,
    user,
    upload,
    media,
    feed
}