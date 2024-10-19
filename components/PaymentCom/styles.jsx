import { StyleSheet,} from 'react-native'

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:40,
        marginHorizontal:10,
    },
    bckContainer:{
        position:'absolute',
    },
    bckIcon:{
        fontSize:30,
        color:'black',
        zIndex:3,
    },
    flutterwaveTxt:{
        fontsize:19,
        fontWeight:'bold',
        textAlign:'center',
    },
    sub:{
        marginTop:60,
        top:'30%'
    },
    input:{
        padding:10,
        borderWidth:1,
        borderRadius:20,
        marginVertical:15,
        marginHorizontal:20,
        fontSize:18,
    },
    btnContainer:{
        justifyContent:'center',
        alignItems:'center',
        height:50,
        width:150,
        backgroundColor:'#0aa30a',
        borderRadius:15,
        alignSelf:'center',
    },
    btnTxt:{
        color:'#ffffff',
        fontSize:18,
        fontWeight:'bold',
        textAlign:'center',
        letterSpacing:0.3,
    },
})

export default styles;
