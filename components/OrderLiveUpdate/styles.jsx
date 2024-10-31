import { StyleSheet,} from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
    },
    bckBtn:{
        position:'absolute',
        top:25,
        left:10,
        height:35,
        width:35,
        borderRadius:10,
        backgroundColor:'#d8d3d3',
        zIndex:2,
        justifyContent:'center',
        alignItems:'center'
    },
    bckBtnIcon:{
        fontSize:30,
        color:'#6e6d6d',
    },
    imageContainer:{
        height:150,
        width:150,
        borderRadius:75,
        backgroundColor:'#a2a2a8',
        justifyContent:'center',
        alignSelf:'center',
        justifyContent:'center',
        alignItems:'center',
        marginVertical:10,
    },
    img:{
        width:'100%',
        height:'100%',
        resizeMode:"contain",
        borderRadius:75,
    },
    courierName:{
        textAlign:'center',
        fontSize:25,
        fontWeight:'bold',
        marginBottom:10,
    }
})

export default styles;