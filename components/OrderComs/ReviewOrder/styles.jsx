import { StyleSheet} from 'react-native'

const styles = StyleSheet.create({
    container:{
        // position:'absolute',
        // flex:1,
        // width:'100%',
        // height:'100%',
        backgroundColor:'#e4e1e1d9',
    },
    txtRow:{
        marginLeft:10,
        marginRight:10,
        marginVertical:8,
    },
    firstTxtRow:{
        margin:10,
        marginTop:120,
    },
    txtTitle:{
        color:'#000000',
        fontSize:22,
        fontWeight:'bold',
        marginLeft:10,
        marginBottom:5
    },
    txt:{
        color:'#dfdfdf',
        padding:7,
        backgroundColor:'#252323',
        borderRadius:25,
        fontSize:19,

    },
    btn:{
        width:150,
        height:70,
        marginVertical:15,
        marginLeft:'auto',
        marginRight:'auto',
        borderRadius:50,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'#04e43c',
    },
    btnTxt:{
        fontWeight:'bold',
        fontSize:30,
        padding:10
    },
    bckBtn:{
        position:'absolute',
        top:40,
        left:10,
        justifyContent:'center',
        alignItems:'center',
    },
    bckBtnIcon:{
        fontSize:35,
        color:"#3d3d3d",
    },
})

export default styles;