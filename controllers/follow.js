//importar modelo 
const Follow = require("../models/follow");
const User = require("../models/user");

//Importar servicios
const followService = require("../service/followService");


//importar denpencias
const mongoosePaginate = require("mongoose-pagination");

//Acciones de prueba
const pruebaFollow = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde: controllers/follow.js"
    });
}

//Accion de guardar un follow (accion de seguir)
const save = async (req, res) => {
    //conseguir datos por body
    const params = req.body;

    //sacar id del usuario identificado
    const identity = req.user;

    //crear objeto con modelo follow
    let UserToFollow = new Follow({
        user: identity.id,
        followed: params.followed
    });

    //guardar objeto en la base de datos
    const followStored = await UserToFollow.save();
    try {
        return res.status(200).send({
            status: "success",
            identity: req.user,
            follow: followStored
        });

    } catch (error) {
        if (!followStored) {
            return res.status(500).send({
                status: "error",
                message: "Error al guardar el seguido"
            });
        }

    }

}

//Accion de borrar un follow (Accion de dejar de seguir)
const unfollow = async (req, res) => {
    //Recoger el id del usuario identificado
    const userId = req.user.id;

    //recoger el id del usuario que sigo y quiero dejar de seguir
    const followedId = req.params.id;


    //find de las coincidencias y hacer remove
    try {
        const followToDelete = await Follow.findOneAndRemove({ "user": userId, "followed": followedId });

        if (!followToDelete) {
            return res.status(500).send({
                status: "error",
                message: "No se ha podido borrar el followed / No hay follower para dejar de seguir"
            });
        }

        return res.status(200).send({
            status: "success",
            message: "follow eliminado correctamente",
            identity: req.user,
            followToDelete
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            status: "error",
            message: "Error al intentar borrar el followed"
        });
    }

}

//Accion listado de usuarios que cualquier usuario esta siguiendo (siguiendo)
const following = async (req, res) => {
    //Sacar el id del usuario identificado
    let userId = req.user.id;

    //comprobar si me llega el id por parametros de url
    if (req.params.id) userId = req.params.id;

    //comprobar si me llega la pagina, si no la pagina 1
    let page = 1;

    if (req.params.page) page = req.params.page

    //usuarios por paginas quiero mostrar
    const itemPerPage = 5;

    //find a follow, popular datos del los usuarios y paginar con mongoose paginate
    const follows = await Follow.find({ user: userId })
        .populate("user followed", "-password -role -__v -email")
        .paginate(page, itemPerPage)
        .exec()
    const total = await Follow.countDocuments();
    try {
        //Listado de usuarios de trinity, y soy victor
        //Sacar un array de ids de los usuarios que me siguen y los que sigo como victor
        let followUserIds = await followService.followUserIds(req.user.id);

        if (follows) {
            return res.status(200).send({
                status: "success",
                message: "Listado de usuarios que estoy siguiendo",
                follows,
                total,
                pages: Math.ceil(total / itemPerPage),
                user_following: followUserIds.following,
                user_follow_me: followUserIds.followers
            });
        }

    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "error"
        })
    }
}

//Accion de listado de usuarios que siguen a cualquier otro usuario (soy seguido, o los seguidores)
const followers = async (req, res) => {
    //Sacar el id del usuario identificado
    let userId = req.user.id;

    //comprobar si me llega el id por parametros de url
    if (req.params.id) userId = req.params.id;

    //comprobar si me llega la pagina, si no la pagina 1
    let page = 1;

    if (req.params.page) page = req.params.page

    //usuarios por paginas quiero mostrar
    const itemPerPage = 5;

    const follows = await Follow.find({ followed: userId })
        .populate("user", "-password -role -__v -email")
        .paginate(page, itemPerPage)
        .exec()
    const total = await Follow.countDocuments();
    try {

        let followUserIds = await followService.followUserIds(req.user.id);

        if (follows) {
            return res.status(200).send({
                status: "success",
                message: "Listado de usuarios que me siguen",
                follows,
                total,
                pages: Math.ceil(total / itemPerPage),
                user_following: followUserIds.following,
                user_follow_me: followUserIds.followers
            });
        }

    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "error"
        })
    }

}

//Accion listado de usuarios que me siguen

//exportar acciones
module.exports = {
    pruebaFollow,
    save,
    unfollow,
    following,
    followers

}