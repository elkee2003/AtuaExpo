import { StyleSheet,} from 'react-native'
import { SearchBar } from 'react-native-screens'

const styles = StyleSheet.create({
    container:{
        flex:1,
        marginTop:40,
        marginHorizontal:10,
    },
    title: {
        fontSize: 30,
        fontWeight: "bold",
        textAlign: "center",
        margin: 10,
    },
    searchBar:{
        padding:9,
        fontSize:17,
        backgroundColor:'white',
        borderWidth:1,
        borderRadius:10,
        marginBottom:20,
    },
    row:{
        flexDirection:'row',
        alignItems:'center',
        backgroundColor:'#c4c2c2',
        padding:5,
        marginBottom:15,
        borderRadius:20,
    },
    imgContainer:{
        height:90,
        width:120,     
    },
    img:{
        width:'100%',
        height:'100%',
        resizeMode:"contain",
        borderTopLeftRadius:20,
        borderBottomLeftRadius:20,
    },
    detailRow:{
        marginLeft:'auto',
        marginRight:15,
    },
    sub:{
        fontsize:18,
        fontWeight:'bold',
    },
    detailFirst:{
        fontsize:19,
        marginBottom:10,
    },
    detail:{
        fontsize:19,
    },
    btnContainer:{
        marginHorizontal:80,
        padding:5,
        borderRadius:20,
        backgroundColor:'#09d809',
        justifyContent:'center',
        alignItems:'center',
        marginBottom:10,
    },
    btnTxt:{
        fontSize:30,
        fontWeight:'bold'
    }
})

export default styles
