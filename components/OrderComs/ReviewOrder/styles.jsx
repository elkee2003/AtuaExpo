import { StyleSheet} from 'react-native'

const styles = StyleSheet.create({
    container:{
        // position:'absolute',
        // flex:1,
        // width:'100%',
        // height:'100%',
        backgroundColor:'#e4e1e1d9',
    },
    pointer:{
        // fontSize:17,
        // color:'black',
        // position:'absolute',
        // top:45,
        // left:'18%'
        fontSize:17,
        fontStyle:'italic',
        textDecorationLine:'underline',
        color:'#494949',
        marginTop:100,
        marginLeft:20,
        marginRight:10,
        marginBottom:15,
    },
    firstTxtRow:{
        marginBottom:8,
        // marginTop:120,
        marginHorizontal:10,
    },
    txtRow:{
        marginHorizontal:10,
        marginVertical:8,
    },
    txtTitle:{
        color:'#0e0d0dd9',
        fontSize:22,
        fontWeight:'bold',
        marginLeft:10,
        marginBottom:5
    },
    txt:{
        color:'#f1efef',
        padding:7,
        backgroundColor:'#0e0d0dd9',
        borderRadius:25,
        fontSize:19,
    },
    btnContainer:{
        position:'absolute',
        bottom:0,
        height:90,
        width:'100%',
        backgroundColor:'#e4e1e1d9'
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