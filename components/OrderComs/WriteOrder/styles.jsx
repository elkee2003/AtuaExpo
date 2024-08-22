import { StyleSheet } from 'react-native'


const styles = StyleSheet.create({
    container:{
        flex:1,
        justifyContent:'center',
    },
    header:{
        fontSize:30,
        fontWeight:'bold',
        marginBottom:20,
        textAlign:'center'
    },
    bckBtn:{
        position:'absolute',
        top:35,
        left:10,
    },
    bckBtnIcon:{
        fontSize:30,
        color:'#3b3b3b',
    },
    input:{
        borderWidth:1,
        borderRadius:20,
        padding:7,
        textAlign:'center',
        justifyContent:'center',
        fontSize:20,
        margin:15
    },
    description:{
        borderWidth:1,
        borderRadius:20,
        textAlign:'center',
        justifyContent:'center',
        fontSize:20,
        margin:15,
        padding:30
    },
    btn:{
        width:125,
        height:60,
        marginLeft:'auto',
        marginRight:'auto',
        borderRadius:50,
        justifyContent:'center',
        alignItems:'center',
        backgroundColor:'#03b630',
    },
    btnTxt:{
        fontWeight:'bold',
        fontSize:25,
        padding:10
    },
    error:{
        color:'#d80b0b',
        marginHorizontal:19,
        marginTop:-13,
        marginBottom:5,
    }
})

export default styles;